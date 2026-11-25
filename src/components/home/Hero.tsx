"use client";

import { useMemo } from "react";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL, MONTH_SHORT, todayAR } from "@/lib/month";
import { pctChange } from "@/lib/plan";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { daysInMonth } from "@/components/debts/obligations";
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

type TxLike = { type: string; date: string; amount: string; currency: "ARS" | "USD"; category_id: string };

/** Gasto acumulado día a día (en pesos) y lo variable hasta un día; card_payment no es gasto. */
function cumulative(txs: TxLike[], ym: string, days: number, upTo: number, toArs: (n: number, c: "ARS" | "USD") => number) {
  const daily = Array.from({ length: days }, () => 0);
  let variable = 0;
  for (const t of txs) {
    if (t.type !== "out" || !t.date.startsWith(ym)) continue;
    const d = Number(t.date.slice(8));
    if (d > days) continue;
    const v = toArs(Number(t.amount), t.currency);
    daily[d - 1] += v;
    if (d <= upTo && CATEGORY_BY_ID[t.category_id]?.kind === "var") variable += v;
  }
  let acc = 0;
  return { cum: daily.map((v) => (acc += v)), variable };
}

/** Saldo del mes con el gráfico del gasto acumulado y la proyección a fin de mes (handoff v11 › Inicio). */
export function Hero() {
  const { month, months, setMonth, user } = useShell();
  const { transactions, toDisplay } = useData();
  const { S, P, isCurrent, prevYm, projectedOut, pendingFixed, toArs } = useSummary();
  const cur = user.display_currency;
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), cur);
  const mIdx = months.indexOf(month);
  const mName = MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase();
  const pName = MONTH_FULL[Number(prevYm.slice(5)) - 1].toLowerCase();
  const mS = MONTH_SHORT[Number(month.slice(5)) - 1];
  const bal = toDisplay(S.inc - S.out, "ARS");

  const evo = useMemo(() => {
    const dN = daysInMonth(month);
    const dNow = isCurrent ? Math.min(Number(todayAR().slice(8)), dN) : dN;
    const curC = cumulative(transactions, month, dN, dNow, toArs);
    const curCum = curC.cum.slice(0, dNow);
    const prevCum = P ? cumulative(transactions, prevYm, dN, dN, toArs).cum : [];
    const cc = curCum[curCum.length - 1] ?? 0;
    const hasProj = isCurrent && dNow < dN && S.out > 0;
    // proyección = gastado hasta hoy + fijos pendientes + (variable hasta hoy / día de hoy) × días restantes
    const projEnd = hasProj ? cc + pendingFixed + (curC.variable / Math.max(1, dNow)) * (dN - dNow) : cc;
    const gMax = Math.max(1, ...curCum, ...prevCum, projEnd, S.inc) * 1.12;
    const gp = (a: number[]) => a.map((v, i): [number, number] => [(i / Math.max(1, dN - 1)) * CW, CH - (v / gMax) * CH]);
    const gc = gp(curCum);
    const gl = gc[gc.length - 1] ?? [0, CH];
    const line = gc.length ? smooth(gc) : "";
    const endY = CH - (projEnd / gMax) * CH;
    const incY = CH - (S.inc / gMax) * CH;
    const over = S.inc > 0 && projEnd > S.inc;
    return {
      cur: line,
      area: line ? `${line} L${f1(gl[0])},${CH} L0,${CH} Z` : "",
      prev: prevCum.length ? smooth(gp(prevCum)) : "",
      proj: hasProj ? `M${f1(gl[0])},${f1(gl[1])} L${CW},${f1(endY)}` : "",
      dotL: `${(gl[0] / CW) * 100}%`,
      dotT: `${(gl[1] / CH) * 100}%`,
      endT: `${(endY / CH) * 100}%`,
      incT: `${(incY / CH) * 100}%`,
      hasProj,
      projEnd,
      projColor: !S.inc ? "var(--fg)" : over ? "var(--red)" : "var(--pos)",
      projSub: !S.inc ? "cargá tus ingresos para compararlo" : over ? `${fmt(projEnd - S.inc)} más que tus ingresos` : `te quedarían ${fmt(S.inc - projEnd)}`,
      x0: `1 ${mS}`,
      xMid: hasProj ? `Hoy · ${dNow} ${mS}` : "",
      x1: `${dN} ${mS}`,
    };
    // fmt depende de toDisplay y cur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, month, prevYm, P, isCurrent, toArs, pendingFixed, S.inc, S.out, mS, cur, toDisplay]);

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
          Ingresos <strong style={{ color: "var(--acc)" }}>{fmt(S.inc)}</strong>
        </span>
        <span>
          Gastos <strong style={{ color: "var(--red)" }}>{fmt(S.out)}</strong>
        </span>
        <span>
          vs. mes anterior{" "}
          <strong style={{ color: better === null ? "var(--mut)" : better ? "var(--pos)" : "var(--red)" }}>{P ? `${pctChange(projectedOut, P.out)} gasto` : "—"}</strong>
        </span>
      </div>

      {evo.hasProj && (
        <div className={h.projPill}>
          <span>Si seguís así, terminás el mes gastando</span>
          <strong style={{ color: evo.projColor }}>{fmt(evo.projEnd)}</strong>
          <small>· {evo.projSub}</small>
        </div>
      )}

      <div className={h.chart} aria-hidden>
        <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="gHero" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--acc)", stopOpacity: 0.22 }} />
              <stop offset="1" style={{ stopColor: "var(--acc)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {evo.prev && <path d={evo.prev} className={h.prevLine} />}
          {evo.area && <path d={evo.area} fill="url(#gHero)" />}
          {evo.proj && <path d={evo.proj} className={h.projLine} />}
          {evo.cur && <path d={evo.cur} className={h.curLine} />}
        </svg>
        {S.inc > 0 && (
          <div className={h.incomeRule} style={{ top: evo.incT }}>
            <span>Ingresos {fmt(S.inc)}</span>
          </div>
        )}
        {evo.cur && (
          <>
            <span className={h.curRule} style={{ left: evo.dotL }} />
            <span className={h.curDot} style={{ left: evo.dotL, top: evo.dotT }} />
          </>
        )}
        {evo.hasProj && (
          <>
            <span className={h.endDot} style={{ top: evo.endT }} />
            <span className={h.endLabel} style={{ top: evo.endT, color: evo.projColor }}>
              {fmt(evo.projEnd)}
            </span>
          </>
        )}
      </div>
      <div className={h.xAxis}>
        <span>{evo.x0}</span>
        <span className={h.xMid}>{evo.xMid}</span>
        <span>{evo.x1}</span>
      </div>
      <div className={h.legend}>
        <span>
          <i style={{ background: "var(--acc)", boxShadow: "0 0 6px var(--acc)" }} />
          Gastado · {mName}
        </span>
        {evo.hasProj && (
          <span>
            <i className={h.dashKey} />
            Proyección
          </span>
        )}
        {P && (
          <span>
            <i style={{ background: "var(--red)", opacity: 0.6 }} />
            {pName}
          </span>
        )}
        {S.inc > 0 && (
          <span>
            <i className={h.incKey} />
            Ingresos
          </span>
        )}
      </div>
    </section>
  );
}
