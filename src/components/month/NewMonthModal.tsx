"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cardFace, type BankId } from "@/lib/banks";
import { CATEGORIES } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL, addMonths, currentMonth, todayAR } from "@/lib/month";
import { VIEWS } from "@/lib/nav";
import { monthTotals } from "@/lib/plan";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import n from "./month.module.css";
import { Bolsi } from "@/components/bolsi/Bolsi";

const LATER_KEY = "ab-nm-later";
type Mode = "keep" | "infl" | "spent";

export function laterToday() {
  try {
    return localStorage.getItem(LATER_KEY) === todayAR();
  } catch {
    return false;
  }
}

/** Modal "Nuevo mes": resumen del mes que cerró, gastos fijos, presupuesto del mes nuevo y resúmenes. */
export function NewMonthModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { flash, setMonth, setImportFor } = useShell();
  const { transactions, bills, cards, ipc, rate, budgetFor, startMonth } = useData();
  const cur = currentMonth();
  const prev = addMonths(cur, -1);
  const next = MONTH_FULL[Number(cur.slice(5)) - 1];
  const prevName = MONTH_FULL[Number(prev.slice(5)) - 1].toLowerCase();
  const [mode, setMode] = useState<Mode>("keep");
  const [drop, setDrop] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const t = monthTotals(transactions, prev, (v, c) => (c === "USD" ? (rate ? v * rate : 0) : v));
  const cats = CATEGORIES.filter((c) => c.type === "out" && c.id !== "prestamo").map((c) => ({
    id: c.id,
    name: c.name,
    limit: budgetFor(prev, c.id).amount,
    spent: t.byCat[c.id] ?? 0,
  }));
  const withLimit = cats.filter((c) => c.limit > 0);
  const over = withLimit.filter((c) => c.spent > c.limit);
  const infl = ipc.at(-1)?.value ?? 0;
  const round = (v: number) => Math.round(v / 1000) * 1000;
  const budgetsFor = (m: Mode) =>
    cats.map((c) => ({
      category_id: c.id,
      amount: round(m === "keep" ? c.limit : m === "infl" ? c.limit * (1 + infl / 100) : c.spent > 0 ? c.spent : c.limit),
    }));
  const total = (m: Mode) => budgetsFor(m).reduce((s, b) => s + b.amount, 0);
  const rateSaved = t.inc ? (t.inc - t.out) / t.inc : 0;
  const activeBills = bills.filter((b) => !drop.includes(b.id));

  const start = async () => {
    setBusy(true);
    const ok = await startMonth({ month: cur, budget_mode: mode, budgets: budgetsFor(mode), drop_bills: drop });
    setBusy(false);
    if (ok) {
      onClose();
      setMonth(cur);
      flash(`${next} arrancó. Bolsi te banca.`, "meta");
    }
  };

  const later = () => {
    try {
      localStorage.setItem(LATER_KEY, todayAR());
    } catch {}
    onClose();
    flash("Te lo recordamos mañana");
  };

  const options: [Mode, string, string][] = [
    ["keep", "Mantener los mismos límites", `Igual que ${prevName}`],
    ["infl", `Ajustar por inflación (+${infl.toFixed(1).replace(".", ",")}%)`, "Según el último IPC"],
    ["spent", `Usar lo que gastaste en ${prevName}`, "Se adapta a tu gasto real"],
  ];

  return (
    <div className={n.backdrop}>
      <div className={n.modal} role="dialog" aria-modal="true" aria-label="Nuevo mes">
        <div className={n.hero}>
          <Bolsi pose="bienvenida" width={84} height={92} />
          <span className={n.kicker}>1 de {next.toLowerCase()}</span>
          <strong>Arrancó {next.toLowerCase()}</strong>
          <span className={n.lead}>Cerramos {prevName} y dejamos listo el mes nuevo. Revisá estos tres pasos.</span>
        </div>

        <div className={n.body}>
          <section className={n.box}>
            <div className={n.boxHead}>
              <strong>Así cerró {prevName}</strong>
              <button
                className={n.link}
                onClick={() => {
                  setMonth(prev);
                  router.push(VIEWS.rep.href);
                  later();
                }}
              >
                Ver reporte
              </button>
            </div>
            <div className={n.kpis}>
              <div>
                <span>Ingresos</span>
                <strong>{formatMoney(t.inc, "ARS")}</strong>
              </div>
              <div>
                <span>Gastos</span>
                <strong>{formatMoney(t.out, "ARS")}</strong>
              </div>
              <div>
                <span>Ahorraste</span>
                <strong style={{ color: t.inc >= t.out ? "var(--pos)" : "var(--red)" }}>{formatMoney(t.inc - t.out, "ARS")}</strong>
              </div>
            </div>
            <span className={n.note}>
              <span className="material-symbols-rounded" style={{ color: over.length ? "var(--amb)" : "var(--pos)" }}>
                {over.length ? "warning" : "check_circle"}
              </span>
              {over.length
                ? `${withLimit.length - over.length} de ${withLimit.length} categorías dentro del presupuesto. Te pasaste en ${over
                    .slice(0, 2)
                    .map((c) => c.name.toLowerCase())
                    .join(" y ")}${over.length > 2 ? ` y ${over.length - 2} más` : ""}.`
                : `Todas las categorías quedaron dentro del presupuesto. Ahorraste el ${Math.round(rateSaved * 100)}% de lo que entró.`}
            </span>
          </section>

          {bills.length > 0 && (
            <section className={n.box}>
              <div className={n.step}>
                <span>1</span>
                <strong>Gastos fijos de {next.toLowerCase()}</strong>
              </div>
              <span className={n.sub}>Los cargamos como pendientes con su fecha. Destildá los que ya no pagás.</span>
              <div className={n.bills}>
                {bills.map((b) => {
                  const on = !drop.includes(b.id);
                  return (
                    <label key={b.id} className={n.bill} style={{ opacity: on ? 1 : 0.5 }}>
                      <input type="checkbox" checked={on} onChange={() => setDrop(on ? [...drop, b.id] : drop.filter((x) => x !== b.id))} />
                      <span>
                        <strong>{b.name}</strong>
                        <small>Vence el {b.due_day}</small>
                      </span>
                      <b>{formatMoney(Number(b.amount), b.currency)}</b>
                    </label>
                  );
                })}
              </div>
              <div className={n.total}>
                <span>
                  {activeBills.length} de {bills.length} gastos fijos
                </span>
                <strong>{formatMoney(activeBills.reduce((s, b) => s + Number(b.amount) * (b.currency === "USD" ? (rate ?? 0) : 1), 0), "ARS")}</strong>
              </div>
            </section>
          )}

          <section className={n.box}>
            <div className={n.step}>
              <span>{bills.length ? 2 : 1}</span>
              <strong>Presupuesto de {next.toLowerCase()}</strong>
            </div>
            <div className={n.options} role="radiogroup" aria-label="Presupuesto del mes nuevo">
              {options.map(([m, label, sub]) => (
                <button key={m} className={n.option} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
                  <span className="material-symbols-rounded">{mode === m ? "radio_button_checked" : "radio_button_unchecked"}</span>
                  <span>
                    <strong>{label}</strong>
                    <small>{sub}</small>
                  </span>
                  <b>{formatMoney(total(m), "ARS")}</b>
                </button>
              ))}
            </div>
          </section>

          {cards.length > 0 && (
            <section className={n.box}>
              <div className={n.step}>
                <span>{bills.length ? 3 : 2}</span>
                <strong>Resúmenes de tarjeta</strong>
              </div>
              <span className={n.sub}>Cuando cierre cada tarjeta, importá el resumen para actualizar saldo, mínimo y cuotas.</span>
              {cards.map((c, i) => (
                <div key={c.id} className={n.card}>
                  <span className={n.chip} style={{ background: cardFace(c.name, c.bank as BankId | null, i).face }} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>Saldo {formatMoney(Number(c.balance), "ARS")}</small>
                  </span>
                  <button
                    className={n.pill}
                    onClick={() => {
                      later();
                      router.push(VIEWS.debts.href);
                      setImportFor({ cardId: c.id });
                    }}
                  >
                    <span className="material-symbols-rounded">upload_file</span>
                    Importar
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>

        <div className={n.actions}>
          <button className={n.secondary} onClick={later}>
            Más tarde
          </button>
          <button className={n.primary} onClick={start} disabled={busy}>
            {busy ? "Arrancando…" : `Empezar ${next.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
