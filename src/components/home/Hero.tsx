"use client";

import { useMemo } from "react";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL } from "@/lib/month";
import { dailyVariableSpend, pctChange } from "@/lib/plan";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { daysInMonth } from "@/components/debts/obligations";
import { todayAR } from "@/components/tx/parts";
import { useSummary } from "./useSummary";
import h from "./dashboard.module.css";

const CW = 600;
const CH = 200;
const f1 = (n: number) => n.toFixed(1);

/** Curva suave (Catmull-Rom → Bézier), igual que el prototipo. */
function smooth(p: [number, number][]) {
  return p
    .map((q, i) => {
      if (!i) return `M${f1(q[0])},${f1(q[1])}`;
      const p0 = p[i - 2] ?? p[i - 1];
      const p1 = p[i - 1];
      const p3 = p[i + 1] ?? q;
      return `C${f1(p1[0] + (q[0] - p0[0]) / 6)},${f1(p1[1] + (q[1] - p0[1]) / 6)} ${f1(q[0] - (p3[0] - p1[0]) / 6)},${f1(q[1] - (p3[1] - p1[1]) / 6)} ${f1(q[0])},${f1(q[1])}`;
    })
    .join(" ");
}

export function Hero() {
  const { month, months, setMonth, user } = useShell();
  const { transactions, toDisplay } = useData();
  const { S, P, isCurrent, prevYm, projectedOut, toArs } = useSummary();
  const cur = user.display_currency;
  const mIdx = months.indexOf(month);
  const mName = MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase();
  const pName = MONTH_FULL[Number(prevYm.slice(5)) - 1].toLowerCase();
  const bal = toDisplay(S.inc - S.out, "ARS");

  const wave = useMemo(() => {
    const n = daysInMonth(month);
    const today = Number(todayAR().slice(8));
    const curDays = isCurrent ? Math.max(1, today) : n;
    const curRaw = dailyVariableSpend(transactions, month, n, toArs).slice(0, curDays);
    const prevRaw = P ? dailyVariableSpend(transactions, prevYm, n, toArs) : [];
    const max = Math.max(1, ...curRaw, ...prevRaw);
    const pts = (a: number[]) => a.map((v, i): [number, number] => [(i / Math.max(1, n - 1)) * CW, CH - 12 - (v / max) * (CH - 36)]);
    const c = pts(curRaw);
    const p = pts(prevRaw);
    const cl = c[c.length - 1];
    const pl = p.length ? p[Math.min(p.length - 1, c.length - 1)] : null;
    const line = smooth(c);
    return {
      cur: line,
      area: `${line} L${f1(cl[0])},${CH} L0,${CH} Z`,
      prev: p.length ? smooth(p) : "",
      curL: `${(cl[0] / CW) * 100}%`,
      curT: `${(cl[1] / CH) * 100}%`,
      prevL: pl ? `${(pl[0] / CW) * 100}%` : "0",
      prevT: pl ? `${(pl[1] / CH) * 100}%` : "0",
    };
  }, [transactions, month, prevYm, P, isCurrent, toArs]);

  const better = P ? projectedOut <= P.out : null;

  return (
    <section className={h.hero} data-tour="hero">
      <div className={h.heroRow}>
        <button className={`${h.heroArrow} material-symbols-rounded`} title="Mes anterior" disabled={mIdx <= 0} onClick={() => setMonth(months[mIdx - 1])}>
          chevron_left
        </button>
        <div className={h.heroValue} aria-label={formatMoney(bal, cur)}>
          <span className={h.heroSym}>
            {bal < 0 ? "−" : ""}
            {cur === "USD" ? "US$" : "$"}
          </span>
          <span className={h.heroNum}>{Math.round(Math.abs(bal)).toLocaleString("es-AR")}</span>
        </div>
        <button className={`${h.heroArrow} material-symbols-rounded`} title="Mes siguiente" disabled={mIdx >= months.length - 1} onClick={() => setMonth(months[mIdx + 1])}>
          chevron_right
        </button>
      </div>
      <div className={h.heroLabel}>
        {isCurrent ? "Saldo disponible · " : "Balance de "}
        {mName} {month.slice(0, 4)}
      </div>
      <div className={h.heroStats}>
        <span>
          Ingresos <strong style={{ color: "var(--acc)" }}>{formatMoney(toDisplay(S.inc, "ARS"), cur)}</strong>
        </span>
        <span>
          Gastos <strong style={{ color: "var(--red)" }}>{formatMoney(toDisplay(S.out, "ARS"), cur)}</strong>
        </span>
        <span>
          vs. mes anterior{" "}
          <strong style={{ color: better === null ? "var(--mut)" : better ? "var(--pos)" : "var(--red)" }}>{P ? `${pctChange(projectedOut, P.out)} gasto` : "—"}</strong>
        </span>
      </div>
      <div className={h.chart} aria-hidden>
        <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="gHero" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--acc)", stopOpacity: 0.22 }} />
              <stop offset="1" style={{ stopColor: "var(--acc)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {wave.prev && <path d={wave.prev} className={h.prevLine} />}
          <path d={wave.area} fill="url(#gHero)" />
          <path d={wave.cur} className={h.curLine} />
        </svg>
        {P && <span className={h.prevDot} style={{ left: wave.prevL, top: wave.prevT }} />}
        <span className={h.curRule} style={{ left: wave.curL }} />
        <span className={h.curDot} style={{ left: wave.curL, top: wave.curT }} />
      </div>
      <div className={h.legend}>
        <span>
          <i style={{ background: "var(--acc)", boxShadow: "0 0 6px var(--acc)" }} />
          Gasto diario · {mName}
        </span>
        {P && (
          <span>
            <i style={{ background: "var(--red)" }} />
            {pName}
          </span>
        )}
      </div>
    </section>
  );
}
