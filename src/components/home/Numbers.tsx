"use client";

import Link from "next/link";
import { CATEGORY_BY_ID, catColor } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { VIEWS } from "@/lib/nav";
import { pctChange } from "@/lib/plan";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { useSummary } from "./useSummary";
import h from "./dashboard.module.css";

const GOOD = { bg: "color-mix(in oklch, var(--pos) 18%, transparent)", fg: "var(--pos)" };
const BAD = { bg: "color-mix(in oklch, var(--red) 18%, transparent)", fg: "var(--red)" };
const NEU = { bg: "var(--sel)", fg: "var(--mut)" };

/** "Mis números" y "Distribución del gasto". */
export function Numbers() {
  const { user } = useShell();
  const { toDisplay } = useData();
  const { S, P, isCurrent, projectedOut, saveRate, prevSaveRate, plan } = useSummary();
  const cur = user.display_currency;
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), cur);

  const stats = [
    {
      icon: "trending_down",
      label: "Gasto del mes",
      sub: isCurrent ? "Proyectado a fin de mes" : "Del mes",
      value: fmt(projectedOut),
      badge: P ? pctChange(projectedOut, P.out) : "—",
      tone: !P ? NEU : projectedOut <= P.out ? GOOD : BAD,
      href: VIEWS.mov.href,
    },
    {
      icon: "payments",
      label: "Ingresos",
      sub: "Sueldo y otros ingresos",
      value: fmt(S.inc),
      badge: P ? pctChange(S.inc, P.inc) : "—",
      tone: !P ? NEU : S.inc >= P.inc ? GOOD : BAD,
      href: VIEWS.mov.href,
    },
    {
      icon: "savings",
      label: "Ahorro",
      sub: isCurrent ? "Proyectado, del ingreso del mes" : "Del ingreso del mes",
      value: S.inc ? `${Math.round(saveRate * 100)}%` : "—",
      badge: P && S.inc ? `${saveRate >= prevSaveRate ? "+" : "−"}${Math.abs((saveRate - prevSaveRate) * 100).toFixed(1).replace(".", ",")} pts` : "—",
      tone: !P || !S.inc ? NEU : saveRate >= prevSaveRate ? GOOD : BAD,
      href: VIEWS.rep.href,
    },
    {
      icon: "credit_card",
      label: "A pagar en tarjetas",
      sub: "Según tu plan",
      value: fmt(plan.cardsTotal),
      badge: "Ver plan",
      tone: { bg: "transparent", fg: "var(--acc)" },
      href: VIEWS.plan.href,
    },
  ];

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

  return (
    <div className={h.row2}>
      <section className={h.panel}>
        <div className={h.blockHead}>
          <span className={h.blockTitle}>Mis números</span>
          <Link href={VIEWS.rep.href} className={h.more}>
            Ver reportes
          </Link>
        </div>
        {stats.map((k) => (
          <div key={k.label} className={h.stat}>
            <span className={`${h.statIcon} material-symbols-rounded`}>{k.icon}</span>
            <div className={h.statText}>
              <strong>{k.label}</strong>
              <span>{k.sub}</span>
            </div>
            <div className={h.statValue}>
              <strong>{k.value}</strong>
              <Link href={k.href} className={h.badge} style={{ background: k.tone.bg, color: k.tone.fg }}>
                {k.badge}
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className={h.panel}>
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
          <div className={h.legendList}>
            {sorted.slice(0, 5).map(([id, v]) => (
              <Link key={id} href={VIEWS.mov.href} className={h.legendItem}>
                <i style={{ background: catColor(id) }} />
                <span className={h.legendName}>{CATEGORY_BY_ID[id]?.name ?? id}</span>
                <span className={h.legendPct}>{Math.round((v / total) * 100)}%</span>
                <span className={h.legendAmount}>{fmt(v)}</span>
              </Link>
            ))}
            {!sorted.length && <span className={h.mutedText}>Todavía no hay gastos este mes.</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
