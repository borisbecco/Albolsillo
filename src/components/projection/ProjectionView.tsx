"use client";

import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL, MONTH_SHORT, addMonths, currentMonth } from "@/lib/month";
import { monthTotals } from "@/lib/plan";
import { CUOTA_OPTS, freeAfter, projectMonths, simulate, type ProjectedMonth } from "@/lib/projection";
import { Bolsi } from "@/components/bolsi/Bolsi";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { useSummary } from "@/components/home/useSummary";
import p from "./projection.module.css";

const monthName = (ym: string) => MONTH_FULL[Number(ym.slice(5)) - 1];
const fullName = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`;

/** Planificar › Proyección: "¿Me lo puedo permitir?" y lo que queda libre los próximos 12 meses. */
export function ProjectionView() {
  const { user, openNewTxWith } = useShell();
  const { transactions, bills, loans, installments, cards, budgetFor, toDisplay } = useData();
  const { C, pendingFixed, reserve, income, toArs } = useSummary();
  const cur = user.display_currency;
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), cur);
  const month = currentMonth();

  const [amountRaw, setAmountRaw] = useState("");
  const [desc, setDesc] = useState("");
  const [cuotas, setCuotas] = useState(6);
  const [surchargeRaw, setSurchargeRaw] = useState("");
  const [sel, setSel] = useState(0);

  const amount = Number(amountRaw) || 0;
  const surcharge = Math.max(0, Number.parseFloat(surchargeRaw.replace(",", ".")) || 0);

  const { months, variableMonthly, billsM } = useMemo(() => {
    const varIds = CATEGORIES.filter((c) => c.type === "out" && c.kind === "var").map((c) => c.id);
    // Gasto variable promedio de los 3 meses anteriores con movimientos; sin historia, lo presupuestado.
    const prev = [1, 2, 3].map((k) => monthTotals(transactions, addMonths(month, -k), toArs)).filter((t) => t.out > 0);
    const variableMonthly = prev.length
      ? prev.reduce((s, t) => s + varIds.reduce((a, id) => a + (t.byCat[id] ?? 0), 0), 0) / prev.length
      : varIds.reduce((s, id) => s + budgetFor(month, id).amount, 0);
    const billsMonthly = bills.reduce((s, b) => s + toArs(Number(b.amount), b.currency), 0);
    const ms = projectMonths({
      month,
      freeNow: income - C.out - pendingFixed - reserve,
      income,
      billsMonthly,
      variableMonthly,
      loans: loans.map((l) => ({ name: l.name, installment: Number(l.installment), n: l.n, of: l.of, paidThisMonth: l.last_paid_month === month })),
      installments: installments.map((q) => ({ name: q.name, amount: Number(q.amount), n: q.n, of: q.of })),
    });
    return { months: ms, variableMonthly, billsM: billsMonthly };
  }, [transactions, bills, loans, installments, budgetFor, month, income, C.out, pendingFixed, reserve, toArs]);

  const r = simulate(months, income, { amount, cuotas, surcharge });
  const colOf = (v: number) => (v < 0 ? "var(--red)" : v < r.buffer ? "var(--amb)" : "var(--acc)");

  const worstName = r.worst ? fullName(r.worst.ym).toLowerCase() : "";
  const verdict = {
    none: ["Probá con una compra", "Poné el importe y la cantidad de cuotas. Te mostramos cómo quedan tus próximos 12 meses.", "var(--mut)"],
    ok: ["Te alcanza", `En el mes más ajustado (${worstName}) te quedan ${fmt(r.worstFree)} libres.`, "var(--pos)"],
    tight: ["Entra, pero justo", `En ${worstName} te quedarían ${fmt(r.worstFree)}. Cualquier gasto imprevisto te deja en rojo.`, "var(--amb)"],
    no: ["No te alcanza", `En ${worstName} te faltarían ${fmt(-r.worstFree)}.`, "var(--red)"],
    pre: ["Primero ordená tus cuentas", "Todos los meses de las cuotas ya vienen en rojo sin esta compra. Revisá el plan de pagos antes de sumar otra.", "var(--red)"],
  }[r.verdict] as [string, string, string];

  const red = r.alreadyRed;
  const preNote =
    r.has && red.length
      ? `${red.length === 1 ? fullName(red[0].ym) : `${red.length} meses`} ${red.length === 1 ? "ya venía" : "ya venían"} en rojo sin esta compra (${fmt(red[0].free)}${red.length > 1 ? ` en ${fullName(red[0].ym).toLowerCase()}` : ""}). La cuota lo empeora en ${fmt(r.cuota)}.`
      : "";
  const tip0 =
    !r.has || r.verdict === "ok" || r.verdict === "pre"
      ? ""
      : r.better
        ? `Con ${r.better} cuotas de ${fmt(r.total / r.better)} sí entra con margen.`
        : "Ni en 18 cuotas entra con margen. Conviene esperar a que terminen otras cuotas o juntar una parte antes.";
  const tip = [preNote, tip0].filter(Boolean).join(" ");

  const freeNow = months[0].free;
  const pct = freeNow > 0 ? Math.min(100, (r.cuota / freeNow) * 100) : 100;
  const maxV = Math.max(1, ...months.map((m) => Math.max(m.free, freeAfter(m, r.cuota, cuotas))));
  const PX = 150;

  const M: ProjectedMonth = months[Math.min(11, sel)];
  const mq = r.has && M.k < cuotas ? r.cuota : 0;
  const rows: { label: string; value: number; acc?: boolean }[] =
    M.k === 0
      ? [
          { label: "Ingresos del mes", value: income },
          { label: "Gastos ya realizados", value: -C.out },
          { label: "Obligaciones fijas pendientes", value: -pendingFixed },
          { label: "Reserva gastos variables", value: -reserve },
        ]
      : [
          { label: "Ingresos estimados", value: income },
          { label: "Gastos fijos", value: -billsM },
          { label: "Préstamos", value: -M.loansA },
          { label: "Cuotas que ya tenés", value: -M.cuotasA },
          { label: "Gasto variable (promedio 3 meses)", value: -variableMonthly },
        ];
  if (mq) rows.push({ label: `Esta compra (cuota ${M.k + 1}/${cuotas})`, value: -mq, acc: true });
  const selFree = M.free - mq;

  const load = () => {
    const card = cards[0];
    openNewTxWith({ amount: Math.round(r.total).toLocaleString("es-AR"), description: desc, source: card ? `card:${card.id}` : undefined, cuotas: card ? cuotas : 1 });
  };

  return (
    <div className={p.wrap}>
      <section className={p.panel}>
        <div className={p.head}>
          <div>
            <strong className={p.title}>¿Me lo puedo permitir?</strong>
            <span className={p.sub}>Probá una compra antes de hacerla y mirá cómo quedan tus próximos meses.</span>
          </div>
          <button
            className={`${p.clear} material-symbols-rounded`}
            title="Limpiar"
            onClick={() => {
              setAmountRaw("");
              setDesc("");
              setSurchargeRaw("");
              setCuotas(6);
            }}
          >
            restart_alt
          </button>
        </div>

        <label className={p.field}>
          Importe de la compra
          <span className={p.amountBox}>
            <span>$</span>
            <input value={amount ? amount.toLocaleString("es-AR") : ""} onChange={(e) => setAmountRaw(e.target.value.replace(/\D/g, "").slice(0, 12))} inputMode="numeric" placeholder="0" aria-label="Importe" />
          </span>
        </label>
        <label className={p.field}>
          Qué es (opcional)
          <input className={p.input} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. Lavarropas" maxLength={60} />
        </label>
        <div className={p.row}>
          <div className={p.field}>
            Cuotas
            <div className={p.seg} role="group" aria-label="Cuotas">
              {CUOTA_OPTS.map((n) => (
                <button key={n} aria-pressed={n === cuotas} onClick={() => setCuotas(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className={p.field}>
            Recargo total
            <span className={p.pctBox}>
              <input value={surchargeRaw} onChange={(e) => setSurchargeRaw(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} inputMode="decimal" placeholder="0" aria-label="Recargo" />
              <span>%</span>
            </span>
          </label>
        </div>

        <div className={p.sep} />
        <div className={p.figures}>
          <div>
            <span>Cuota mensual</span>
            <strong>{r.has ? fmt(r.cuota) : "—"}</strong>
          </div>
          <div>
            <span>Te queda libre este mes</span>
            <strong style={{ color: r.has ? colOf(freeNow - r.cuota) : "var(--fg)" }}>{fmt(r.has ? freeNow - r.cuota : freeNow)}</strong>
          </div>
          <div>
            <span>{r.has && r.worst ? `Mes más ajustado · ${worstName}` : "Mes más ajustado"}</span>
            <strong style={{ color: r.has && r.worst ? colOf(r.worstFree) : "var(--fg)" }}>{r.has && r.worst ? fmt(r.worstFree) : "—"}</strong>
          </div>
        </div>
        <div className={p.meter}>
          <div className={p.meterHead}>
            <span>Cuánto se come de tu libre de este mes</span>
            <strong>{r.has ? `${(Math.round(pct * 10) / 10).toLocaleString("es-AR")}%` : "0%"}</strong>
          </div>
          <div className={p.meterTrack}>
            <div style={{ width: `${r.has ? pct : 0}%`, background: r.has ? colOf(freeNow - r.cuota) : "var(--acc)" }} />
          </div>
        </div>

        <div className={p.verdict} style={{ background: `color-mix(in oklch, ${verdict[2]} 12%, var(--panel))`, borderColor: `color-mix(in oklch, ${verdict[2]} 35%, var(--line2))` }}>
          <Bolsi key={r.verdict} pose={r.verdict === "ok" ? "meta" : r.verdict === "none" ? "bienvenida" : "alerta"} width={56} height={62} />
          <div className={p.verdictText}>
            <strong style={{ color: verdict[2] }}>{verdict[0]}</strong>
            <span>{verdict[1]}</span>
            {tip && <span className={p.tip}>{tip}</span>}
          </div>
        </div>
        <span className={p.foot}>
          Total {fmt(r.total)}. {surcharge > 0 ? `Con el recargo pagás ${fmt(r.total - amount)} más que de contado.` : "Sin recargo."} La primera cuota cuenta en el mes de la compra.
        </span>
        {r.has && cards.length > 0 && (
          <button className={p.load} onClick={load}>
            <span className="material-symbols-rounded">add_card</span>
            La hice: cargar la compra
          </button>
        )}
      </section>

      <div className={p.side}>
        <section className={p.panel}>
          <div className={p.chartHead}>
            <strong>Lo que te queda libre cada mes</strong>
            <span className={p.keys}>
              <span>
                <i style={{ background: "var(--acc)" }} />
                Con la compra
              </span>
              <span>
                <i className={p.ghostKey} />
                Sin la compra
              </span>
              <span>
                <i className={p.dotKey} />
                Termina una cuota
              </span>
            </span>
          </div>
          <div className={p.bars}>
            {months.map((m) => {
              const a = r.has ? freeAfter(m, r.cuota, cuotas) : m.free;
              const on = m.k === sel;
              return (
                <button key={m.ym} className={p.bar} aria-pressed={on} title={`${fullName(m.ym)} · libre ${fmt(a)}`} onClick={() => setSel(m.k)}>
                  <div className={p.barTop} style={{ height: PX }}>
                    <div className={p.ghost} style={{ height: (Math.max(0, m.free) / maxV) * PX, opacity: r.has && m.k < cuotas ? 1 : 0 }} />
                    <div className={p.pos} style={{ height: (Math.max(0, a) / maxV) * PX, background: colOf(a) }} />
                  </div>
                  <div className={p.axis} />
                  <div className={p.barBottom}>
                    <div className={p.neg} style={{ height: Math.min(40, (Math.max(0, -a) / maxV) * PX) }} />
                  </div>
                  <span className={p.barLabel}>
                    <i style={{ background: m.ends.length ? "var(--pos)" : "transparent" }} />
                    {MONTH_SHORT[Number(m.ym.slice(5)) - 1].replace(/^./, (c) => c.toUpperCase())}
                    <small>{m.k === 0 ? "hoy" : m.ym.slice(2, 4)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={p.panel}>
          <strong className={p.selTitle}>{fullName(M.ym)}</strong>
          {rows.map((row) => (
            <div key={row.label} className={p.selRow} style={{ color: row.acc ? "var(--acc)" : undefined }}>
              <span>{row.label}</span>
              <span>{fmt(row.value)}</span>
            </div>
          ))}
          <div className={p.sep} />
          <div className={p.selFree}>
            <span>Libre</span>
            <span style={{ color: colOf(selFree) }}>{fmt(selFree)}</span>
          </div>
          {M.ends.map((e) => (
            <div key={e.name} className={p.ends}>
              <span className="material-symbols-rounded">event_available</span>
              <span>
                <strong>{e.name}</strong>
                <span>
                  Última cuota. Desde {monthName(addMonths(M.ym, 1)).toLowerCase()} se liberan {fmt(e.amt)} por mes.
                </span>
              </span>
            </div>
          ))}
          <span className={p.note}>
            {M.k === 0
              ? "Este mes usamos lo que ya pasó: ingresos y gastos reales, más lo que falta pagar."
              : "Estimado con tus ingresos de este mes, tus gastos fijos, las cuotas que siguen y tu gasto variable promedio de los últimos 3 meses."}
          </span>
        </section>
      </div>
    </div>
  );
}
