"use client";

import { useEffect, useState } from "react";
import { entityDomain } from "@/lib/entities";
import { formatMoney, maskAmountEvent, parseAmount, toDecimal, toInput, type Currency } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { ACCOUNT_KINDS } from "@/components/accounts/kinds";
import { useSummary } from "@/components/home/useSummary";
import { Logo } from "@/components/shell/Logo";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import d from "./debts.module.css";

/** Registrar el pago del resumen de una tarjeta (Recomendado / Mínimo / Total, y la cuenta de origen). */
export function CardPaySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { flash } = useShell();
  const { cards, accounts, payCard, voidTx } = useData();
  const { plan } = useSummary();
  const card = cards.find((c) => c.id === id);
  const hasUsd = !!card && Number(card.balance_usd) > 0;
  const [cur, setCur] = useState<Currency>("ARS");
  const [amount, setAmount] = useState("");
  const [acc, setAcc] = useState<string | null>(accounts.find((a) => a.currency === "ARS")?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!card) return null;
  const U = cur === "USD";
  const fx = (v: number) => formatMoney(v, cur);
  const paid = U ? Number(card.cycle_paid_usd) : Number(card.cycle_paid);
  const bal = U ? Number(card.balance_usd) : Number(card.balance);
  const owed = Math.max(0, bal - paid);
  const minLeft = U ? 0 : Math.min(owed, Math.max(0, Number(card.min_payment) - paid));
  const row = plan.rows.find((r) => r.id === card.id);
  const rec = U ? owed : Math.min(owed, Math.max(minLeft, row?.pay ?? minLeft));
  const quick = (
    U
      ? ([["Total en dólares", owed]] as const)
      : ([
          ["Recomendado", rec],
          ["Mínimo", minLeft],
          ["Total en pesos", owed],
        ] as const)
  ).filter(([, v], i, a) => v > 0 && a.findIndex((x) => Math.round(x[1]) === Math.round(v)) === i);
  const facts = U
    ? [
        ["Saldo en dólares", fx(bal)],
        ["Ya pagaste", fx(paid)],
        ["Te falta", fx(owed)],
      ]
    : [
        ["Saldo en pesos", fx(bal)],
        ["Ya pagaste", fx(paid)],
        ["Mínimo", fx(Number(card.min_payment))],
      ];
  const accs = accounts.filter((a) => a.currency === cur);
  const value = parseAmount(amount);

  const switchCur = (c: Currency) => {
    setCur(c);
    setAmount("");
    setErr("");
    setAcc(accounts.find((a) => a.currency === c)?.id ?? null);
  };

  const save = async () => {
    if (!value) return setErr("Poné cuánto pagaste");
    setBusy(true);
    const txId = await payCard(card.id, { amount: toDecimal(value), account_id: acc, currency: cur });
    setBusy(false);
    if (!txId) return;
    onClose();
    const done = paid + value >= bal - 0.005;
    flash(done ? `Pagaste el total de ${card.name}` : "Registramos el pago", done ? "meta" : "ingreso", {
      label: "Deshacer",
      fn: async () => {
        if (await voidTx(txId)) flash("Anulamos el pago");
      },
    });
  };

  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 32 }}>
      <div className={t.sheet} role="dialog" aria-modal="true" aria-label={`Pagar ${card.name}`} onClick={(e) => e.stopPropagation()}>
        <div className={t.top}>
          <span className={d.sheetTitle}>Pagar {card.name}</span>
          <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
            close
          </button>
        </div>
        {hasUsd && (
          <div className={d.segTabs} role="group" aria-label="Moneda">
            {(
              [
                ["ARS", "Pesos"],
                ["USD", "Dólares"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} aria-pressed={cur === v} onClick={() => switchCur(v)}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className={d.facts}>
          {facts.map(([l, v]) => (
            <div key={l}>
              <span>{l}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <div className={d.payFrom}>
          <span>¿Cuánto pagaste?</span>
          {quick.length > 0 && (
            <div className={d.quickPills}>
              {quick.map(([l, v]) => (
                <button key={l} aria-pressed={Math.round(value) === Math.round(v)} onClick={() => (setAmount(toInput(Math.round(v))), setErr(""))}>
                  <span>{l}</span>
                  <strong>{fx(v)}</strong>
                </button>
              ))}
            </div>
          )}
          <label className={d.payAmount}>
            <span>{U ? "US$" : "$"}</span>
            <input
              value={amount}
              onChange={(e) => {
                setErr("");
                setAmount(maskAmountEvent(e));
              }}
              inputMode="decimal"
              placeholder="0"
              aria-label="Monto"
            />
          </label>
        </div>
        <div className={d.payFrom}>
          <span>Sale de</span>
          {accs.length ? (
            <div className={d.payAccs}>
              {accs.map((a) => (
                <button key={a.id} className={d.payAcc} aria-pressed={acc === a.id} onClick={() => setAcc(acc === a.id ? null : a.id)}>
                  <Logo domain={a.kind === "efectivo" ? null : entityDomain(a.name)} icon={ACCOUNT_KINDS[a.kind].icon} size={26} />
                  {a.name}
                </button>
              ))}
            </div>
          ) : (
            <span style={{ color: "var(--amb)" }}>No tenés cuentas en esa moneda. Agregá una en Cuentas.</span>
          )}
        </div>
        <p className={d.hint}>Se descuenta de la cuenta y el plan se recalcula. No suma como gasto: las compras ya se contaron cuando las cargaste.</p>
        {err && (
          <div className={t.error} role="alert">
            {err}
          </div>
        )}
        <button className={t.primary} onClick={save} disabled={busy}>
          {busy ? "Guardando…" : "Registrar pago"}
        </button>
      </div>
    </div>
  );
}
