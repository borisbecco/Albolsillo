"use client";

import { useState } from "react";
import { formatMoney, maskAmountEvent, parseAmount, toDecimal } from "@/lib/money";
import { MONTH_FULL, todayAR } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import type { InvestmentDto } from "@/lib/savings";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import s from "./savings.module.css";

const KIND = {
  pf: { label: "Plazo fijo", icon: "lock_clock", hue: 250 },
  fci: { label: "Fondo común", icon: "water_drop", hue: 190 },
  usd: { label: "Dólares", icon: "attach_money", hue: 150 },
} as const;

const DAYS = [30, 60, 90, 180, 365];
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const pct = (n: number, sign = true) => `${sign && n >= 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(1).replace(".", ",")}%`;

/** Valor actual e intereses de una inversión (interés simple sobre la TNA, como el prototipo). */
function valueOf(i: InvestmentDto, rate: number | null, today: string) {
  const elapsed = Math.max(0, dayDiff(i.start_date, today));
  const amount = Number(i.amount);
  if (i.kind === "usd") return { value: rate ? amount * rate : 0, earned: 0, atEnd: amount, left: 0, elapsed };
  const tna = Number(i.tna ?? 0) / 100;
  const days = i.kind === "pf" ? Math.min(elapsed, i.days ?? 0) : elapsed;
  const earned = (amount * tna * days) / 365;
  const atEnd = i.kind === "pf" ? amount + (amount * tna * (i.days ?? 0)) / 365 : amount + earned;
  return { value: amount + earned, earned, atEnd, left: i.kind === "pf" ? Math.max(0, (i.days ?? 0) - elapsed) : 0, elapsed };
}

export function InvestmentsView() {
  const { user, forced, flash } = useShell();
  const { investments, accounts, rate, ipc, closeInvestment, toDisplay } = useData();
  const today = todayAR();
  const cur = user.display_currency;

  if (!investments.length && !forced.inv) return <EmptyState copy={EMPTY.inv!} />;

  // Inflación: la del último mes publicado y el promedio de los últimos 3.
  const last3 = ipc.slice(-3);
  const ipcAvg = last3.length ? last3.reduce((t, r) => t + r.value, 0) / last3.length : 2;
  const ipcNow = ipc.at(-1);

  const rows = investments.map((i) => ({ i, ...valueOf(i, rate, today) }));
  const total = rows.reduce((t, r) => t + r.value, 0);
  const earned = rows.reduce((t, r) => t + r.earned, 0);
  const pesos = rows.filter((r) => r.i.kind !== "usd");
  const wTna = pesos.reduce((t, r) => t + Number(r.i.tna ?? 0) * Number(r.i.amount), 0);
  const wAmt = pesos.reduce((t, r) => t + Number(r.i.amount), 0);
  const monthly = wAmt ? wTna / wAmt / 12 : 0;
  const beats = ipcNow ? monthly >= ipcNow.value : null;

  const close = async (i: InvestmentDto, amount: number) => {
    const acc = await closeInvestment(i.id, toDecimal(amount));
    if (acc === false) return;
    flash(acc ? `Acreditado en ${acc.name}` : "Inversión cerrada", "ingreso");
  };

  return (
    <div className={s.wrap}>
      {investments.length > 0 && (
        <div className={s.kpis}>
          <div className={s.kpi}>
            <span>Total invertido</span>
            <strong>{formatMoney(toDisplay(total, "ARS"), cur)}</strong>
            <small>
              {investments.length} {investments.length === 1 ? "inversión" : "inversiones"}
            </small>
          </div>
          <div className={s.kpi}>
            <span>Intereses ganados</span>
            <strong style={{ color: "var(--pos)" }}>{formatMoney(toDisplay(earned, "ARS"), cur)}</strong>
            <small>Hasta hoy, en pesos</small>
          </div>
          <div className={s.kpi}>
            <span>Rinde por mes</span>
            <strong style={{ color: beats === null ? "var(--fg)" : beats ? "var(--pos)" : "var(--red)" }}>{monthly.toFixed(1).replace(".", ",")}%</strong>
            <small>
              {ipcNow
                ? `Inflación de ${MONTH_FULL[Number(ipcNow.month.slice(5)) - 1].toLowerCase()}: ${String(ipcNow.value).replace(".", ",")}% · ${beats ? "le ganás" : "perdés"} ${Math.abs(monthly - ipcNow.value).toFixed(1).replace(".", ",")} pts`
                : "Inflación no disponible"}
            </small>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className={s.invGrid}>
          {rows.map(({ i, value, earned: e, atEnd, left, elapsed }) => {
            const k = KIND[i.kind];
            const end = i.kind === "pf" ? new Date(Date.parse(`${i.start_date}T00:00:00Z`) + (i.days ?? 0) * 86_400_000) : null;
            const sub =
              i.kind === "pf"
                ? left
                  ? `Vence el ${end!.getUTCDate()} de ${MONTH_FULL[end!.getUTCMonth()].toLowerCase()} · cobrás ${formatMoney(atEnd, "ARS")}`
                  : `Venció · ${formatMoney(atEnd, "ARS")} listos para acreditar`
                : i.kind === "fci"
                  ? "Rescate en el día · rinde todos los días"
                  : `Comprados el ${Number(i.start_date.slice(8))} de ${MONTH_FULL[Number(i.start_date.slice(5, 7)) - 1].toLowerCase()}`;
            const action = i.kind === "pf" ? (left ? null : "Acreditar") : i.kind === "usd" ? "Vender" : "Rescatar";
            return (
              <section key={i.id} className={s.inv}>
                <div className={s.invHead}>
                  <span className={`${s.invIcon} material-symbols-rounded`} style={{ background: `oklch(0.76 0.15 ${k.hue} / .14)`, color: `oklch(0.76 0.15 ${k.hue})` }}>
                    {k.icon}
                  </span>
                  <div>
                    <strong>{i.name}</strong>
                    <span>
                      {k.label} · {i.kind === "usd" ? `${formatMoney(Number(i.amount), "USD")}${rate ? ` a ${formatMoney(rate, "ARS")}` : ""}` : `TNA ${Number(i.tna)}%`}
                    </span>
                  </div>
                </div>
                <div className={s.invValue}>
                  <strong>{formatMoney(toDisplay(value, "ARS"), cur)}</strong>
                  {i.kind !== "usd" && <span>+{formatMoney(toDisplay(e, "ARS"), cur)}</span>}
                </div>
                {i.kind === "pf" && (
                  <div className={s.invBar}>
                    <div style={{ width: `${Math.min(100, (elapsed / (i.days ?? 1)) * 100)}%` }} />
                  </div>
                )}
                <div className={s.invFoot}>
                  <span>{sub}</span>
                  {action && (
                    <button
                      className={s.pillBtn}
                      onClick={() => close(i, i.kind === "usd" ? Number(i.amount) : i.kind === "pf" ? atEnd : value)}
                    >
                      {action}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Simulator ipcAvg={ipcAvg} hasAccounts={accounts.some((a) => a.currency === "ARS")} />
      <OtherInvestment />
    </div>
  );
}

function Simulator({ ipcAvg, hasAccounts }: { ipcAvg: number; hasAccounts: boolean }) {
  const { flash } = useShell();
  const { accounts, createInvestment } = useData();
  const pesos = accounts.filter((a) => a.currency === "ARS");
  const [amount, setAmount] = useState("1.000.000");
  const [tna, setTna] = useState("32");
  const [days, setDays] = useState(30);
  const [acc, setAcc] = useState(pesos[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const a = parseAmount(amount);
  const t = parseAmount(tna);
  const interest = (a * t * days) / 100 / 365;
  const tea = t ? Math.pow(1 + ((t / 100) * days) / 365, 365 / days) - 1 : 0;
  const inflation = Math.pow(1 + ipcAvg / 100, days / 30) - 1;
  const real = a ? (1 + interest / a) / (1 + inflation) - 1 : 0;

  const constitute = async () => {
    if (!a) return flash("Ingresá un monto");
    if (!acc) return flash("Agregá una cuenta en pesos para debitar el plazo fijo");
    const account = pesos.find((x) => x.id === acc);
    const bank = account ? account.name.replace(/^(Cuenta|Caja de ahorro( en (pesos|dólares))?)\s*/i, "") : "";
    setBusy(true);
    const ok = await createInvestment({
      kind: "pf",
      name: `Plazo fijo ${bank}`.trim(),
      amount: toDecimal(a),
      currency: "ARS",
      tna: String(t),
      start_date: todayAR(),
      days,
      account_id: acc,
    });
    setBusy(false);
    if (ok) flash("Plazo fijo constituido", "meta");
  };

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <strong>Simulador de plazo fijo</strong>
        <span>Usá la TNA que te ofrece tu banco hoy.</span>
      </div>
      <div className={s.row}>
        <label className={s.field} style={{ flex: "1 1 160px" }}>
          Monto en pesos
          <input className={s.input} value={amount} onChange={(e) => setAmount(maskAmountEvent(e))} inputMode="decimal" />
        </label>
        <label className={s.field} style={{ flex: "0 1 110px" }}>
          TNA %
          <input className={s.input} value={tna} onChange={(e) => setTna(maskAmountEvent(e))} inputMode="decimal" />
        </label>
        <div className={s.field}>
          Plazo
          <div className={s.seg} role="group" aria-label="Plazo">
            {DAYS.map((d) => (
              <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>
                {d === 30 ? "30 días" : d}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={s.simOut}>
        <div>
          <span>Interés</span>
          <strong style={{ color: "var(--pos)" }}>{formatMoney(interest, "ARS")}</strong>
        </div>
        <div>
          <span>Cobrás al vencimiento</span>
          <strong>{formatMoney(a + interest, "ARS")}</strong>
        </div>
        <div>
          <span>TEA</span>
          <strong>{(tea * 100).toFixed(1).replace(".", ",")}%</strong>
        </div>
        <div>
          <span>Rendimiento real</span>
          <strong style={{ color: real >= 0 ? "var(--pos)" : "var(--red)" }}>{pct(real)}</strong>
        </div>
      </div>
      <span className={s.note}>
        El rendimiento real descuenta una inflación estimada de {pct(inflation, false)} en {days} días (promedio de los últimos 3 meses:{" "}
        {ipcAvg.toFixed(1).replace(".", ",")}% mensual).
      </span>
      <div className={s.row} style={{ justifyContent: "flex-end" }}>
        {hasAccounts ? (
          <label className={s.field} style={{ flex: "0 1 220px" }}>
            Debitar de
            <select className={s.input} value={acc} onChange={(e) => setAcc(e.target.value)}>
              {pesos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className={s.note}>Agregá una cuenta en pesos para constituir el plazo fijo.</span>
        )}
        <button className={s.primary} onClick={constitute} disabled={busy || !hasAccounts}>
          <span className="material-symbols-rounded">lock_clock</span>
          {busy ? "Constituyendo…" : "Constituir plazo fijo"}
        </button>
      </div>
    </section>
  );
}

/** Registrar un fondo común o una compra de dólares. */
function OtherInvestment() {
  const { flash } = useShell();
  const { accounts, createInvestment } = useData();
  const [kind, setKind] = useState<"fci" | "usd">("fci");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [tna, setTna] = useState("");
  const options = accounts.filter((a) => (kind === "fci" ? a.currency === "ARS" : true));
  const [acc, setAcc] = useState("");
  const [busy, setBusy] = useState(false);
  const accId = options.some((o) => o.id === acc) ? acc : (options[0]?.id ?? "");

  const save = async () => {
    if (!parseAmount(amount)) return flash("Ingresá un monto");
    if (!accId) return flash("Agregá una cuenta para registrar la inversión");
    setBusy(true);
    const ok = await createInvestment({
      kind,
      name: name.trim() || (kind === "fci" ? "Fondo común" : "Dólares"),
      amount: toDecimal(parseAmount(amount)),
      currency: kind === "usd" ? "USD" : "ARS",
      tna: kind === "fci" ? String(parseAmount(tna) || 0) : null,
      start_date: todayAR(),
      days: null,
      account_id: accId,
    });
    setBusy(false);
    if (ok) {
      flash(kind === "fci" ? "Fondo registrado" : "Dólares registrados", "meta");
      setName("");
      setAmount("");
      setTna("");
    }
  };

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <strong>Registrar otra inversión</strong>
        <span>Un fondo común de inversión o dólares que compraste.</span>
      </div>
      <div className={s.row}>
        <div className={s.field}>
          Tipo
          <div className={s.seg} role="group" aria-label="Tipo de inversión">
            <button aria-pressed={kind === "fci"} onClick={() => setKind("fci")}>
              Fondo común
            </button>
            <button aria-pressed={kind === "usd"} onClick={() => setKind("usd")}>
              Dólares
            </button>
          </div>
        </div>
        <label className={s.field} style={{ flex: "1 1 160px" }}>
          Nombre
          <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "fci" ? "Ej. FCI Mercado Pago" : "Ej. Dólares MEP"} maxLength={60} />
        </label>
        <label className={s.field} style={{ flex: "1 1 130px" }}>
          Monto ({kind === "usd" ? "US$" : "$"})
          <input className={s.input} value={amount} onChange={(e) => setAmount(maskAmountEvent(e))} inputMode="decimal" placeholder="0" />
        </label>
        {kind === "fci" && (
          <label className={s.field} style={{ flex: "0 1 100px" }}>
            TNA %
            <input className={s.input} value={tna} onChange={(e) => setTna(maskAmountEvent(e))} inputMode="decimal" placeholder="0" />
          </label>
        )}
        <label className={s.field} style={{ flex: "1 1 160px" }}>
          {kind === "usd" ? "Cuenta" : "Debitar de"}
          <select className={s.input} value={accId} onChange={(e) => setAcc(e.target.value)} disabled={!options.length}>
            {options.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <button className={s.primary} onClick={save} disabled={busy || !options.length}>
          {busy ? "Guardando…" : "Registrar"}
        </button>
      </div>
      {kind === "usd" && <span className={s.note}>Si la cuenta es en dólares se descuenta de su saldo; si es en pesos, solo queda registrada la compra.</span>}
    </section>
  );
}

