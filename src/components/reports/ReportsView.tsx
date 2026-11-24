"use client";

import { useMemo, useState } from "react";
import { ApiClientError, download } from "@/lib/api-client";
import { CATEGORY_BY_ID, catColor } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL, currentMonth } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import { monthTotals } from "@/lib/plan";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { CatIcon } from "@/components/tx/parts";
import r from "./reports.module.css";

const RING = 326.7;
const pctS = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1).replace(".", ",")}%`;

export function ReportsView() {
  const { month, months, setMonth, user, flash } = useShell();
  const { transactions, bills, isBillPaid, ipc, rate, toDisplay } = useData();
  const [real, setReal] = useState(false);
  const cur = user.display_currency;
  const nowYm = currentMonth();
  const curName = MONTH_FULL[Number(nowYm.slice(5)) - 1].toLowerCase();

  const data = useMemo(() => {
    const toArs = (n: number, c: "ARS" | "USD") => (c === "USD" ? (rate ? n * rate : 0) : n);
    const pendingFixed = bills.filter((b) => !isBillPaid(b.id, nowYm)).reduce((s, b) => s + toArs(Number(b.amount), b.currency), 0);

    // IPC por mes: oficial si está publicado; si no, estimado con el promedio de los últimos 3 publicados.
    const official = new Map(ipc.map((x) => [x.month, x.value]));
    const last3 = ipc.slice(-3);
    const estimate = last3.length ? last3.reduce((s, x) => s + x.value, 0) / last3.length : 2;
    const ipcOf = (ym: string) => ({ value: official.get(ym) ?? Math.round(estimate * 10) / 10, official: official.has(ym) });
    // Factor para llevar un mes a pesos del mes actual: inflación acumulada de los meses posteriores.
    const factor = (ym: string) => months.filter((m) => m > ym).reduce((f, m) => f * (1 + ipcOf(m).value / 100), 1);

    const hist = months.map((ym) => {
      const t = monthTotals(transactions, ym, toArs);
      return { ym, inc: t.inc, out: ym === nowYm ? t.out + pendingFixed : t.out, rawOut: t.out, byCat: t.byCat };
    });
    return { toArs, ipcOf, factor, hist };
  }, [transactions, bills, isBillPaid, ipc, rate, months, nowYm]);

  if (!transactions.length) return <EmptyState copy={EMPTY.rep!} />;

  const { ipcOf, factor, hist, toArs } = data;
  const k = (ym: string) => (real ? factor(ym) : 1);
  const sel = hist.find((h) => h.ym === month) ?? hist[hist.length - 1];
  const isCur = month === nowYm;
  const mName = MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase();
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), cur);

  // Balance y ahorro del mes elegido
  const bal = (sel.inc - sel.rawOut) * k(month);
  const saveRate = sel.inc ? (sel.inc - sel.out) / sel.inc : 0;
  const fixed = Object.entries(sel.byCat)
    .filter(([id]) => CATEGORY_BY_ID[id]?.kind === "fix")
    .reduce((s, [, v]) => s + v, 0);
  const fixP = sel.rawOut ? fixed / sel.rawOut : 0;

  // Barras de 6 meses
  const histK = hist.map((h) => ({ ...h, inc: h.inc * k(h.ym), out: h.out * k(h.ym) }));
  const hmax = Math.max(1, ...histK.flatMap((h) => [h.inc, h.out]));
  const net = histK.reduce((s, h) => s + h.inc - h.out, 0);

  // Por categoría
  const cats = Object.entries(sel.byCat)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = sel.rawOut || 1;
  let acc = 0;
  const donut = cats.length
    ? `conic-gradient(${cats
        .map(([id, v]) => {
          const a = acc;
          acc += (v / total) * 100;
          return `${catColor(id)} ${a.toFixed(2)}% ${(acc - 0.4).toFixed(2)}%, transparent ${(acc - 0.4).toFixed(2)}% ${acc.toFixed(2)}%`;
        })
        .join(", ")})`
    : "var(--line2)";

  // Dónde más gastás (variables del mes, por descripción)
  const merch = new Map<string, { name: string; cat: string; total: number; n: number }>();
  for (const t of transactions) {
    if (t.type !== "out" || !t.date.startsWith(month) || CATEGORY_BY_ID[t.category_id]?.kind !== "var") continue;
    const key = t.description.trim().toLowerCase();
    const m = merch.get(key) ?? { name: t.description.trim(), cat: t.category_id, total: 0, n: 0 };
    m.total += toArs(Number(t.amount), t.currency);
    m.n += 1;
    merch.set(key, m);
  }
  const top = [...merch.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  const topMax = top[0]?.total || 1;

  // Inflación y tu gasto
  const first = hist[0];
  const last = hist[hist.length - 1];
  const nomCh = first.out ? last.out / first.out - 1 : 0;
  const cumInf = factor(first.ym) - 1;
  const realCh = first.out ? last.out / (first.out * factor(first.ym)) - 1 : 0;
  const lastOfficial = [...ipc].pop();

  const exportPdf = async () => {
    try {
      await download(`/export/pdf?month=${month}&scope=all`, `albolsillo-${month}.pdf`);
      flash("Descargamos el PDF");
    } catch (e) {
      flash(e instanceof ApiClientError ? e.message : "No pudimos generar el PDF.", "errorguardar");
    }
  };

  return (
    <div className={r.wrap}>
      <div className={r.toolbar}>
        <div className={r.seg} role="group" aria-label="Valores">
          <button aria-pressed={!real} onClick={() => setReal(false)}>
            Valores nominales
          </button>
          <button aria-pressed={real} onClick={() => setReal(true)}>
            Ajustado por inflación
          </button>
        </div>
        <button className={r.pillBtn} onClick={exportPdf}>
          <span className="material-symbols-rounded">picture_as_pdf</span>
          Exportar PDF
        </button>
      </div>

      <div className={r.three}>
        <section className={r.card}>
          <span className={`${r.iconBubble} material-symbols-rounded`}>account_balance_wallet</span>
          <div className={r.spacer} />
          <span className={r.mut}>{isCur ? "Balance del mes" : `Balance de ${mName}`}</span>
          <strong className={r.big} style={{ color: bal < 0 ? "var(--red)" : "var(--fg)" }}>
            {fmt(bal)}
          </strong>
        </section>
        <section className={`${r.card} ${r.row}`}>
          <div className={r.ring}>
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="52" className={r.track} />
              <circle cx="60" cy="60" r="52" className={r.bar} style={{ strokeDasharray: `${(Math.max(0, Math.min(1, saveRate)) * RING).toFixed(1)} ${RING}` }} />
            </svg>
            <span>{sel.inc ? `${Math.round(saveRate * 100)}%` : "—"}</span>
          </div>
          <div className={r.col}>
            <strong>Tasa de ahorro</strong>
            <span className={r.mut}>{isCur ? "Proyectada a fin de mes" : "Del ingreso del mes"}</span>
          </div>
        </section>
        <section className={r.card}>
          <strong>Fijo vs variable</strong>
          <div className={r.spacer} />
          <div className={r.fixRow}>
            <span>
              <b style={{ color: "var(--acc2)" }}>{Math.round(fixP * 100)}%</b>
              <small>Fijo</small>
            </span>
            <span style={{ alignItems: "flex-end" }}>
              <b>{sel.rawOut ? 100 - Math.round(fixP * 100) : 0}%</b>
              <small>Variable</small>
            </span>
          </div>
          <div className={r.fixBar}>
            <div style={{ width: `${fixP * 100}%` }} />
            <div />
          </div>
        </section>
      </div>

      <div className={r.two}>
        <section className={r.card}>
          <div className={r.head}>
            <strong>
              Últimos 6 meses{real && <em> en pesos de {curName}</em>}
            </strong>
            <div className={r.legend}>
              <span>
                <i style={{ background: "var(--acc)", boxShadow: "0 0 8px var(--acc)" }} />
                Ingresos
              </span>
              <span>
                <i style={{ background: "var(--red)" }} />
                Gastos
              </span>
            </div>
          </div>
          <div className={r.bars}>
            {histK.map((h) => {
              const on = h.ym === month;
              const nm = MONTH_FULL[Number(h.ym.slice(5)) - 1];
              return (
                <button
                  key={h.ym}
                  className={r.barCol}
                  data-on={on}
                  title={`${nm} · ingresos ${fmt(h.inc)} · gastos ${fmt(h.out)}`}
                  onClick={() => setMonth(h.ym)}
                >
                  <div className={r.barPair}>
                    <div className={r.inBar} style={{ height: `${(h.inc / hmax) * 100}%` }} />
                    <div className={r.outBar} style={{ height: `${(h.out / hmax) * 100}%` }} />
                  </div>
                  <span>{nm.slice(0, 3)}</span>
                </button>
              );
            })}
          </div>
          <div className={r.foot}>
            <span>{real ? `Ahorro acumulado en 6 meses (pesos de ${curName})` : "Ahorro acumulado en 6 meses"}</span>
            <strong style={{ color: net < 0 ? "var(--red)" : "var(--pos)" }}>{fmt(net)}</strong>
          </div>
        </section>

        <section className={r.card}>
          <strong>Por categoría</strong>
          <div className={r.donutRow}>
            <div className={r.donut} style={{ background: donut }}>
              <div>
                <span>Gastado</span>
                <strong>{fmt(sel.rawOut * k(month))}</strong>
              </div>
            </div>
            <div className={r.catList}>
              {cats.map(([id, v]) => (
                <div key={id} className={r.catItem}>
                  <i style={{ background: catColor(id), boxShadow: `0 0 8px ${catColor(id)}` }} />
                  <span className={r.catName}>{CATEGORY_BY_ID[id]?.name ?? id}</span>
                  <span className={r.dim}>{Math.round((v / total) * 100)}%</span>
                  <span className={r.catAmount}>{fmt(v * k(month))}</span>
                </div>
              ))}
              {!cats.length && <span className={r.mut}>Sin gastos en {mName}.</span>}
            </div>
          </div>
        </section>
      </div>

      {top.length > 0 && (
        <section className={r.card}>
          <div className={r.head}>
            <strong>Dónde más gastás</strong>
            <span className={r.dim}>Gastos variables · {mName}</span>
          </div>
          {top.map((m) => (
            <div key={m.name} className={r.merch}>
              <CatIcon id={m.cat} />
              <div className={r.merchMain}>
                <div>
                  <span>{m.name}</span>
                  <strong>{fmt(m.total * k(month))}</strong>
                </div>
                <div className={r.merchBar}>
                  <div>
                    <div style={{ width: `${(m.total / topMax) * 100}%` }} />
                  </div>
                  <span>
                    {m.n} {m.n === 1 ? "compra" : "compras"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className={r.card}>
        <div className={r.head}>
          <div className={r.col}>
            <strong>Inflación y tu gasto</strong>
            <span className={r.ipcSrc}>
              <i style={{ background: ipc.length ? "var(--pos)" : "var(--dim)" }} />
              {ipc.length && lastOfficial
                ? `IPC del INDEC hasta ${MONTH_FULL[Number(lastOfficial.month.slice(5)) - 1].toLowerCase()} ${lastOfficial.month.slice(0, 4)}. Los meses sin publicar son estimados.`
                : "Sin conexión con el INDEC. Usamos valores estimados."}
            </span>
          </div>
        </div>
        <div className={r.summary}>
          Entre {MONTH_FULL[Number(first.ym.slice(5)) - 1].toLowerCase()} y {curName} tu gasto mensual pasó de {fmt(first.out)} a {fmt(last.out)} ({pctS(nomCh)}). Con una inflación
          acumulada de {pctS(cumInf)}, en términos reales {realCh >= 0 ? "aumentó" : "bajó"} {pctS(realCh).replace(/^[+−]/, "")}.
        </div>
        <div className={r.table}>
          <span className={r.th}>Mes</span>
          <span className={r.th}>IPC %</span>
          <span className={`${r.th} ${r.right}`}>Gasto nominal</span>
          <span className={`${r.th} ${r.right}`}>En pesos de {curName}</span>
          {hist.map((h) => {
            const x = ipcOf(h.ym);
            return (
              <div key={h.ym} className={r.tr}>
                <span style={{ fontWeight: 500 }}>{MONTH_FULL[Number(h.ym.slice(5)) - 1]}</span>
                <span className={r.ipcCell}>
                  {x.value.toFixed(1).replace(".", ",")}
                  <small style={{ color: x.official ? "var(--pos)" : "var(--amb)" }}>{x.official ? "INDEC" : "Estimado"}</small>
                </span>
                <span className={r.right}>{fmt(h.out)}</span>
                <span className={r.right} style={{ fontWeight: 600 }}>
                  {fmt(h.out * factor(h.ym))}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
