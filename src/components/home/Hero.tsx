"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL, MONTH_SHORT, todayAR } from "@/lib/month";
import { VIEWS } from "@/lib/nav";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { pctChange } from "@/lib/plan";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { daysInMonth } from "@/components/debts/obligations";
import { useSummary } from "./useSummary";
import h from "./dashboard.module.css";

const CW = 600;
const CH = 200;
const f1 = (n: number) => n.toFixed(1);

/** Gasto acumulado día a día (en pesos) de un mes; card_payment no es gasto. */
function cumulative(txs: { type: string; date: string; amount: string; currency: "ARS" | "USD"; category_id: string }[], ym: string, days: number, toArs: (n: number, c: "ARS" | "USD") => number) {
  const daily = Array.from({ length: days }, () => 0);
  let variable = 0;
  for (const t of txs) {
    if (t.type !== "out" || !t.date.startsWith(ym)) continue;
    const d = Number(t.date.slice(8)) - 1;
    if (d >= days) continue;
    const v = toArs(Number(t.amount), t.currency);
    daily[d] += v;
    if (CATEGORY_BY_ID[t.category_id]?.kind === "var") variable += v;
  }
  let acc = 0;
  return { cum: daily.map((v) => (acc += v)), variable };
}

/** "Cuánto tengo, cuánto debo, cuánto puedo gastar y cómo termino el mes": disponible, indicadores y evolución. */
export function Hero() {
  const { month, months, setMonth, user } = useShell();
  const { transactions, toDisplay } = useData();
  const { S, P, isCurrent, prevYm, projectedOut, pendingFixed, plan, income, saveRate, toArs } = useSummary();
  const cur = user.display_currency;
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), cur);
  // Importes cortos para los ejes ("$ 1,2 M", "$ 600 mil").
  const short = (n: number) => {
    const v = toDisplay(n, "ARS");
    const p = cur === "USD" ? "US$ " : "$ ";
    if (Math.abs(v) >= 1e6) return `${p}${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
    if (Math.abs(v) >= 1e3) return `${p}${Math.round(v / 1e3).toLocaleString("es-AR")} mil`;
    return `${p}${Math.round(v)}`;
  };
  const mIdx = months.indexOf(month);
  const mName = MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase();
  const pName = MONTH_FULL[Number(prevYm.slice(5)) - 1].toLowerCase();
  const pShort = MONTH_SHORT[Number(prevYm.slice(5)) - 1];
  const n = daysInMonth(month);
  const today = isCurrent ? Number(todayAR().slice(8)) : n;
  const daysLeft = Math.max(1, n - today + 1);

  const bal = S.inc - S.out;
  // Lo obligatorio que falta pagar este mes: gastos fijos, cuotas de préstamos y mínimos de tarjetas sin cubrir.
  const pending = isCurrent ? pendingFixed + plan.mins : 0;
  const perDay = Math.max(0, bal - pending) / daysLeft;

  const chart = useMemo(() => {
    const curC = cumulative(transactions, month, n, toArs);
    const prevC = P ? cumulative(transactions, prevYm, n, toArs) : null;
    const curLine = curC.cum.slice(0, today);
    const spent = curLine[curLine.length - 1] ?? 0;
    // Proyección: lo gastado + fijos pendientes + el ritmo de gasto variable por los días que faltan.
    const projected = isCurrent ? spent + pendingFixed + (curC.variable / Math.max(1, today)) * (n - today) : spent;
    const top = Math.max(1, spent, projected, income, ...(prevC?.cum ?? [])) * 1.08;
    const x = (i: number) => (i / Math.max(1, n - 1)) * CW;
    const y = (v: number) => CH - (v / top) * CH;
    const path = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${f1(x(i))},${f1(y(v))}`).join(" ");
    const last = curLine.length - 1;
    return {
      cur: path(curLine),
      area: curLine.length ? `${path(curLine)} L${f1(x(last))},${CH} L0,${CH} Z` : "",
      prev: prevC ? path(prevC.cum) : "",
      proj: isCurrent && last < n - 1 ? `M${f1(x(last))},${f1(y(spent))} L${f1(x(n - 1))},${f1(y(projected))}` : "",
      incomeY: income ? `${(y(income) / CH) * 100}%` : null,
      dotL: `${(x(last) / CW) * 100}%`,
      dotT: `${(y(spent) / CH) * 100}%`,
      spent,
      projected,
      ticks: [0, 0.5, 1].map((f) => ({ label: short(top * f), y: y(top * f), top: `${(y(top * f) / CH) * 100}%` })),
      days: [1, Math.round(n / 3), Math.round((2 * n) / 3), n].map((d) => ({ label: `${d} ${MONTH_SHORT[Number(month.slice(5)) - 1]}`, left: `${(x(d - 1) / CW) * 100}%` })),
    };
    // short depende de cur y toDisplay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, month, prevYm, P, isCurrent, toArs, n, today, pendingFixed, income, cur, toDisplay]);

  const better = P ? projectedOut <= P.out : null;
  const tiles = [
    { icon: "payments", label: "Ingresos", value: fmt(S.inc), sub: P ? `${pctChange(S.inc, P.inc)} vs. ${pShort}` : "Este mes", tone: "var(--acc)" },
    {
      icon: "trending_down",
      label: "Gastos",
      value: fmt(S.out),
      sub: P ? `${pctChange(projectedOut, P.out)} vs. ${pShort}${isCurrent ? " (proy.)" : ""}` : "Este mes",
      tone: better === null ? "var(--mut)" : better ? "var(--pos)" : "var(--red)",
    },
    isCurrent
      ? { icon: "today", label: "Disponible por día", value: fmt(perDay), sub: `${daysLeft} ${daysLeft === 1 ? "día restante" : "días restantes"}`, tone: "var(--mut)" }
      : { icon: "savings", label: "Ahorro", value: S.inc ? `${Math.round(saveRate * 100)}%` : "—", sub: "Del ingreso del mes", tone: "var(--mut)" },
    isCurrent
      ? {
          icon: "event_upcoming",
          label: "Pagos pendientes",
          value: fmt(pending),
          sub: pending > 0 ? "Fijos, cuotas y mínimos de tarjetas" : "Fijos y mínimos al día",
          tone: pending > 0 ? "var(--amb)" : "var(--pos)",
          href: VIEWS.plan.href,
        }
      : { icon: "calendar_month", label: "Gasto por día", value: fmt(S.out / n), sub: "Promedio del mes", tone: "var(--mut)" },
  ];

  return (
    <section className={h.hero} data-tour="hero">
      <div className={h.heroRow}>
        <button className={`${h.heroArrow} material-symbols-rounded`} title="Mes anterior" disabled={mIdx <= 0} onClick={() => setMonth(months[mIdx - 1])}>
          chevron_left
        </button>
        <div className={h.heroCenter}>
          <div className={h.heroLabel}>{isCurrent ? "Disponible este mes" : `Balance de ${mName} ${month.slice(0, 4)}`}</div>
          <div className={h.heroValue} aria-label={fmt(bal)}>
            <span className={h.heroSym}>
              {bal < 0 ? "−" : ""}
              {cur === "USD" ? "US$" : "$"}
            </span>
            <span className={h.heroNum}>{Math.round(Math.abs(toDisplay(bal, "ARS"))).toLocaleString("es-AR")}</span>
          </div>
          {S.inc > 0 && (
            <div className={h.heroSub} style={{ color: bal < 0 ? "var(--red)" : "var(--mut)" }}>
              {Math.round((bal / S.inc) * 100)}% de tus ingresos
            </div>
          )}
        </div>
        <button className={`${h.heroArrow} material-symbols-rounded`} title="Mes siguiente" disabled={mIdx >= months.length - 1} onClick={() => setMonth(months[mIdx + 1])}>
          chevron_right
        </button>
      </div>

      <div className={h.kpis}>
        {tiles.map((t) => {
          const body = (
            <>
              <span className={`${h.kpiIcon} material-symbols-rounded`}>{t.icon}</span>
              <span className={h.kpiLabel}>{t.label}</span>
              <strong className={h.kpiValue}>{t.value}</strong>
              <span className={h.kpiSub} style={{ color: t.tone }}>
                {t.sub}
              </span>
            </>
          );
          return "href" in t && t.href ? (
            <Link key={t.label} href={t.href} className={h.kpi}>
              {body}
            </Link>
          ) : (
            <div key={t.label} className={h.kpi}>
              {body}
            </div>
          );
        })}
      </div>

      <div className={h.evo}>
        <div className={h.evoHead}>
          <strong>Evolución del mes</strong>
          {isCurrent && chart.proj && (
            <span>
              Si seguís así, terminás gastando <strong style={{ color: chart.projected > income ? "var(--red)" : "var(--fg)" }}>{fmt(chart.projected)}</strong>
            </span>
          )}
        </div>
        <div className={h.chart} aria-hidden>
          {chart.ticks.slice(1).map((t) => (
            <span key={t.label} className={h.yTick} style={{ top: t.top }}>
              {t.label}
            </span>
          ))}
          <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="gHero" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--acc)", stopOpacity: 0.22 }} />
                <stop offset="1" style={{ stopColor: "var(--acc)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {chart.ticks.map((t) => (
              <line key={t.label} x1={0} x2={CW} y1={t.y} y2={t.y} className={h.gridLine} />
            ))}
            {chart.prev && <path d={chart.prev} className={h.prevLine} />}
            {chart.area && <path d={chart.area} fill="url(#gHero)" />}
            {chart.proj && <path d={chart.proj} className={h.projLine} />}
            {chart.cur && <path d={chart.cur} className={h.curLine} />}
          </svg>
          {chart.incomeY && (
            <span className={h.incomeRule} style={{ top: chart.incomeY }}>
              <span>Ingresos {short(income)}</span>
            </span>
          )}
          {chart.cur && <span className={h.curDot} style={{ left: chart.dotL, top: chart.dotT }} />}
          {chart.days.map((d, i) => (
            <span key={d.label} className={h.xTick} style={{ left: d.left, transform: i === 0 ? "none" : i === chart.days.length - 1 ? "translateX(-100%)" : undefined }}>
              {d.label}
            </span>
          ))}
        </div>
        <div className={h.legend}>
          <span>
            <i style={{ background: "var(--acc)", boxShadow: "0 0 6px var(--acc)" }} />
            Gastado · {mName}: {fmt(chart.spent)}
          </span>
          {chart.proj && (
            <span>
              <i className={h.dashKey} />
              Proyección a fin de mes
            </span>
          )}
          {P && (
            <span>
              <i style={{ background: "var(--red)" }} />
              {pName}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
