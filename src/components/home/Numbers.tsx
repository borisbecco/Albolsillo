"use client";

import Link from "next/link";
import { CATEGORY_BY_ID, catColor } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { VIEWS } from "@/lib/nav";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { useSummary } from "./useSummary";
import { pctChange } from "@/lib/plan";
import { currentMonth, todayAR } from "@/lib/month";
import { dueInfo, useObligations } from "@/components/debts/obligations";
import h from "./dashboard.module.css";

/** "Distribución del gasto". */
export function DistPanel() {
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

const GOOD = { bg: "color-mix(in oklch, var(--pos) 18%, transparent)", fg: "var(--pos)" };
const BAD = { bg: "color-mix(in oklch, var(--red) 18%, transparent)", fg: "var(--red)" };
const NEU = { bg: "var(--sel)", fg: "var(--mut)" };

/** "Mis números": gasto proyectado, ingresos, ahorro y el próximo vencimiento. */
export function StatsPanel() {
  const { user } = useShell();
  const { toDisplay } = useData();
  const { S, P, isCurrent, projectedOut, saveRate, prevSaveRate } = useSummary();
  const cur = user.display_currency;
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), cur);
  const nowMonth = currentMonth();
  const today = Number(todayAR().slice(8));
  const next = useObligations(nowMonth).find((o) => !o.paid && o.day >= today);
  const nextDue = next ? dueInfo(nowMonth, next.day, next.paid) : null;

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
      sub: "Del ingreso del mes",
      value: S.inc ? `${Math.round(saveRate * 100)}%` : "—",
      badge: P && S.inc ? `${saveRate >= prevSaveRate ? "+" : "−"}${Math.abs((saveRate - prevSaveRate) * 100).toFixed(1).replace(".", ",")} pts` : "—",
      tone: !P || !S.inc ? NEU : saveRate >= prevSaveRate ? GOOD : BAD,
      href: VIEWS.rep.href,
    },
    next && nextDue
      ? { icon: "event", label: "Próximo vencimiento", sub: `${next.name} · ${nextDue.label}`, value: formatMoney(toDisplay(next.amount, next.currency), cur), badge: "Ver", tone: { bg: "transparent", fg: nextDue.color }, href: VIEWS.cal.href }
      : { icon: "event_available", label: "Próximo vencimiento", sub: "Nada más este mes", value: "—", badge: "Todo al día", tone: { bg: "transparent", fg: "var(--pos)" }, href: VIEWS.cal.href },
  ];

  return (
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
  );
}
