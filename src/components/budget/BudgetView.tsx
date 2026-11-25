"use client";

import { useState } from "react";
import { CATEGORIES, catColor } from "@/lib/categories";
import { formatMoney, maskAmountEvent, parseAmount, toDecimal, toInput } from "@/lib/money";
import { MONTH_FULL } from "@/lib/month";
import { monthTotals } from "@/lib/plan";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import b from "./budget.module.css";

const RING = 326.7; // 2πr con r = 52

/** Presupuesto del mes: límite por categoría (editable), gastado y restante. */
export function BudgetView() {
  const { month, isPastMonth, flash } = useShell();
  const { transactions, budgetFor, saveBudget, rate } = useData();
  const totals = monthTotals(transactions, month, (n, c) => (c === "USD" ? (rate ? n * rate : 0) : n));
  const mName = MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase();

  const rows = CATEGORIES.filter((c) => c.type === "out" && c.id !== "prestamo").map((c) => {
    const { amount, custom } = budgetFor(month, c.id);
    return { ...c, limit: amount, custom, spent: totals.byCat[c.id] ?? 0 };
  });
  const budgeted = rows.reduce((s, r) => s + r.limit, 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  // Lo que queda solo cuenta las categorías con límite (las que no tienen no se pueden "pasar").
  const left = rows.filter((r) => r.limit > 0).reduce((s, r) => s + r.limit - r.spent, 0);

  return (
    <div className={b.wrap}>
      <div className={b.kpis}>
        <div className={b.kpi}>
          <span>Presupuestado</span>
          <strong>{formatMoney(budgeted, "ARS")}</strong>
        </div>
        <div className={b.kpi}>
          <span>Gastado en {mName}</span>
          <strong>{formatMoney(spent, "ARS")}</strong>
        </div>
        <div className={b.kpi}>
          <span>Restante</span>
          <strong style={{ color: left < 0 ? "var(--red)" : "var(--pos)" }}>{formatMoney(left, "ARS")}</strong>
        </div>
      </div>

      <div className={b.head}>
        <span>Categorías</span>
        <span>{isPastMonth ? "En un mes pasado no se puede editar" : "Tocá el límite para editarlo"}</span>
      </div>

      <div className={b.grid}>
        {rows.map((r) => {
          // Sin límite: se muestra lo gastado, sin porcentaje ni alarma.
          const noLimit = !r.limit;
          const p = noLimit ? 0 : r.spent / r.limit;
          const color = noLimit ? "var(--mut)" : p >= 1 ? "var(--red)" : p >= 0.8 ? "var(--amb)" : "var(--acc)";
          const rest = r.limit - r.spent;
          return (
            <section key={r.id} className={b.card}>
              <div className={b.cardTop}>
                <span className={b.kind}>{r.kind === "fix" ? "Fijo" : "Variable"}</span>
                <span style={{ color, fontWeight: 600, fontSize: 12 }}>{noLimit ? "Sin límite" : `${Math.round(p * 100)}%`}</span>
              </div>
              <div className={b.ring}>
                <svg viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r="52" className={b.track} />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    className={b.bar}
                    style={{ stroke: color, strokeDasharray: `${(Math.min(1, p) * RING).toFixed(1)} ${RING}`, filter: `drop-shadow(0 0 6px ${color})` }}
                  />
                </svg>
                <span className={`${b.icon} material-symbols-rounded`} style={{ color: catColor(r.id) }}>
                  {r.icon}
                </span>
              </div>
              <div className={b.info}>
                <strong>{r.name}</strong>
                <span className={b.spent}>{formatMoney(r.spent, "ARS")}</span>
                <span style={{ color: !noLimit && rest < 0 ? "var(--red)" : "var(--mut)" }}>
                  {noLimit ? "Poné un límite si querés controlarla" : rest < 0 ? `Excedido ${formatMoney(-rest, "ARS")}` : `Quedan ${formatMoney(rest, "ARS")}`}
                </span>
              </div>
              <LimitInput
                key={`${month}-${r.limit}`}
                value={r.limit}
                custom={r.custom}
                disabled={isPastMonth}
                label={`Límite de ${r.name}`}
                onSave={async (v) => {
                  if (v === r.limit) return;
                  if (await saveBudget(month, r.id, toDecimal(v))) flash(`Límite de ${r.name}: ${formatMoney(v, "ARS")}`);
                }}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LimitInput({ value, custom, disabled, label, onSave }: { value: number; custom: boolean; disabled: boolean; label: string; onSave: (v: number) => void }) {
  const [text, setText] = useState(value ? toInput(value) : "");
  const commit = () => {
    const v = parseAmount(text);
    setText(v ? toInput(v) : "");
    onSave(v);
  };
  return (
    <label className={b.limit} title={custom ? "Límite propio" : "Límite sugerido"}>
      Límite $
      <input
        value={text}
        onChange={(e) => setText(maskAmountEvent(e))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        inputMode="numeric"
        placeholder="Sin límite"
        disabled={disabled}
        aria-label={label}
        data-custom={custom}
      />
    </label>
  );
}
