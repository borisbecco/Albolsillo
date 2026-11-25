"use client";

import Link from "next/link";
import { CATEGORY_BY_ID, catColor } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { VIEWS } from "@/lib/nav";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { useSummary } from "./useSummary";
import h from "./dashboard.module.css";

/** "Distribución del gasto" (los números del mes están arriba, en Inicio). */
export function Numbers() {
  const { user, month } = useShell();
  const { toDisplay, transactions } = useData();
  const { S } = useSummary();
  const cur = user.display_currency;
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), cur);

  // Dona: categorías con gasto, de mayor a menor (conic-gradient con separadores).
  const sorted = Object.entries(S.byCat)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = S.out || 1;
  let acc = 0;
  const donut = sorted.length
    ? `conic-gradient(${sorted
        .map(([id, v]) => {
          const a = acc;
          acc += (v / total) * 100;
          return `${catColor(id)} ${a.toFixed(2)}% ${(acc - 0.4).toFixed(2)}%, transparent ${(acc - 0.4).toFixed(2)}% ${acc.toFixed(2)}%`;
        })
        .join(", ")})`
    : "var(--line2)";

  // Mucho en "Otros": el gráfico no dice nada. Se invita a categorizar esos movimientos.
  const otros = S.byCat.otros ?? 0;
  const otrosCount = transactions.filter((t) => t.type === "out" && t.category_id === "otros" && t.date.startsWith(month)).length;
  const otrosShare = otros / total;

  return (
    <section className={`${h.panel} ${h.distPanel}`}>
      <div className={h.blockHead}>
        <span className={h.blockTitle}>Distribución del gasto</span>
        <Link href={VIEWS.rep.href} className={h.more}>
          Reportes →
        </Link>
      </div>
      <div className={h.donutRow}>
        <div className={h.donut} style={{ background: donut }}>
          <div className={h.donutHole}>
            <span>Total</span>
            <strong>{fmt(S.out)}</strong>
          </div>
        </div>
        <div className={`${h.legendList} ${h.legendCols}`}>
          {sorted.slice(0, 8).map(([id, v]) => (
            <Link key={id} href={`${VIEWS.mov.href}?cat=${id}`} className={h.legendItem}>
              <i style={{ background: catColor(id) }} />
              <span className={h.legendName}>{CATEGORY_BY_ID[id]?.name ?? id}</span>
              <span className={h.legendPct}>{Math.round((v / total) * 100)}%</span>
              <span className={h.legendAmount}>{fmt(v)}</span>
            </Link>
          ))}
          {!sorted.length && <span className={h.mutedText}>Todavía no hay gastos este mes.</span>}
        </div>
      </div>
      {otrosShare >= 0.2 && otrosCount >= 2 && (
        <Link href={`${VIEWS.mov.href}?cat=otros`} className={h.otrosHint}>
          <span className="material-symbols-rounded">sell</span>
          <span>
            El <strong>{Math.round(otrosShare * 100)}%</strong> de tus gastos está en «Otros» ({otrosCount} movimientos). Ponéles categoría para que este gráfico te sirva.
          </span>
          <span className={h.otrosBtn}>Categorizar</span>
        </Link>
      )}
    </section>
  );
}
