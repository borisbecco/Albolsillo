"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_BY_ID } from "@/lib/categories";
import { formatMoney, maskAmountEvent, parseAmount, toDecimal, toInput, type Currency } from "@/lib/money";
import { useData, type Tx } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { CatIcon, sourceKey, sourceOptions, splitSource } from "./parts";
import s from "./tx.module.css";
import { Bolsi } from "@/components/bolsi/Bolsi";
import { todayAR } from "@/lib/month";

export function TxDetail() {
  const { detailId } = useShell();
  const { transactions } = useData();
  const tx = transactions.find((t) => t.id === detailId);
  // key: si se abre otro movimiento, el formulario arranca de cero.
  if (!tx) return null;
  return tx.type === "card_payment" ? <CardPaymentDetail key={tx.id} tx={tx} /> : <Detail key={tx.id} tx={tx} />;
}

/** Pago del resumen de una tarjeta: no se edita (no es gasto); se puede borrar con Deshacer. */
function CardPaymentDetail({ tx }: { tx: Tx }) {
  const { setDetailId } = useShell();
  const { accounts, cards, deleteTxs } = useData();
  const close = () => setDetailId(null);
  const card = cards.find((c) => c.id === tx.card_id);
  const acc = accounts.find((a) => a.id === tx.account_id);
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div className={s.backdrop} onClick={close} style={{ zIndex: 32 }}>
      <div className={`${s.sheet} ${s.detail}`} role="dialog" aria-modal="true" aria-label="Pago de tarjeta" onClick={(e) => e.stopPropagation()}>
        <div className={s.glow} />
        <button className={`${s.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={close}>
          close
        </button>
        <span className={`${s.bigIcon} material-symbols-rounded`} style={{ width: 80, height: 80, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--elev)", fontSize: 36 }} aria-hidden>
          credit_card
        </span>
        <strong style={{ fontSize: 18 }}>{tx.description}</strong>
        <div className={s.detailAmount}>
          <span className={s.amount}>{formatMoney(Number(tx.gross_amount), tx.currency)}</span>
        </div>
        <div className={s.meta}>
          {card ? `Pago de ${card.name}` : "Pago de tarjeta"}
          {acc ? ` desde ${acc.name}` : ""} · {tx.date.split("-").reverse().join("/")}
        </div>
        <div className={s.meta}>No cuenta como gasto: las compras ya se contaron cuando las cargaste.</div>
        <div className={s.actions}>
          <button
            className={s.delete}
            data-confirm={confirmDel}
            onClick={() => {
              if (!confirmDel) return setConfirmDel(true);
              close();
              void deleteTxs([tx.id]);
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              delete
            </span>
            {confirmDel ? "¿Seguro?" : "Anular pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ tx }: { tx: Tx }) {
  const { setDetailId } = useShell();
  const { accounts, cards, updateTx, deleteTxs } = useData();
  const close = () => setDetailId(null);

  const [desc, setDesc] = useState(tx.description);
  const [amount, setAmount] = useState(toInput(tx.gross_amount));
  const [currency, setCurrency] = useState<Currency>(tx.currency);
  const [cat, setCat] = useState(tx.category_id);
  const [date, setDate] = useState(tx.date);
  const [recurring, setRecurring] = useState(tx.recurring);
  const [source, setSource] = useState<string | null>(sourceKey(tx));
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const type = tx.type === "in" ? "in" : "out";
  const options = sourceOptions(accounts, cards, type, currency);
  const isIn = tx.type === "in";
  const cats = CATEGORIES.filter((c) => c.type === type && (c.id !== "prestamo" || cat === "prestamo"));
  const shared = tx.shared_expense_id !== null && tx.amount !== tx.gross_amount;

  const save = async () => {
    const value = parseAmount(amount);
    if (!value) return setErr("Ingresá un monto");
    setBusy(true);
    const ok = await updateTx(tx.id, {
      description: desc.trim(),
      amount: toDecimal(value),
      currency,
      category_id: cat,
      date,
      recurring,
      ...splitSource(source),
    });
    setBusy(false);
    // El aviso ("Movimiento actualizado" o la propuesta de pasar los demás del mismo comercio) lo muestra updateTx.
    if (ok) close();
  };

  const remove = async () => {
    if (!confirmDel) return setConfirmDel(true);
    close();
    await deleteTxs([tx.id]);
  };

  return (
    <div className={s.backdrop} onClick={close} style={{ zIndex: 32 }}>
      <div
        className={`${s.sheet} ${s.detail}`}
        data-type={tx.type}
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del movimiento"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={s.glow} />
        <button className={`${s.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={close}>
          close
        </button>
        <CatIcon id={cat} size={80} className={s.bigIcon} />
        <input className={s.descInline} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={CATEGORY_BY_ID[cat]?.name} aria-label="Descripción" maxLength={120} />
        <div className={s.detailAmount}>
          <button className={s.curBtn} onClick={() => setCurrency((c) => (c === "ARS" ? "USD" : "ARS"))} title="Cambiar moneda">
            {isIn ? "+" : "−"}
            {currency === "USD" ? "US$" : "$"}
          </button>
          <input
            className={s.amount}
            style={{ color: isIn ? "var(--pos)" : "var(--fg)" }}
            value={amount}
            inputMode="decimal"
            aria-label="Monto"
            onChange={(e) => {
              setAmount(maskAmountEvent(e));
              setErr("");
            }}
          />
        </div>
        {err && <div className={s.error}>{err}</div>}
        {shared && <div className={s.meta}>Gasto compartido: tu parte es {toInput(tx.amount)}</div>}

        <div className={s.extras}>
          <select className={s.pillInput} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input type="date" className={s.pillInput} value={date} max={todayAR()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Fecha" />
          <button className={s.pillBtn} aria-pressed={recurring} onClick={() => setRecurring((r) => !r)}>
            ↻ Mensual
          </button>
        </div>

        {options.length > 0 && (
          <div className={s.chips} style={{ maxWidth: "100%" }}>
            {options.map((o) => (
              <button key={o.key} className={s.chip} aria-pressed={source === o.key} onClick={() => setSource(source === o.key ? null : o.key)}>
                <span className={`${s.ic} material-symbols-rounded`}>{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        )}

        {tx.status !== "synced" && <div className={s.meta}>Guardado en este dispositivo. Se sincroniza cuando haya conexión.</div>}

        <div className={s.actions}>
          <button className={s.delete} data-confirm={confirmDel} onClick={remove}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              delete
            </span>
            {confirmDel ? "¿Seguro?" : "Eliminar"}
          </button>
          <button className={s.primary} onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SaveErrorBar() {
  const { failed, retryFailed, dismissFailed } = useData();
  if (!failed) return null;
  return (
    <div className={s.saveErr} role="alert">
      <Bolsi pose="errorguardar" />
      <span className={s.saveErrText}>
        <strong>No pudimos guardar “{failed.description}”</strong>
        <span>Lo dejamos guardado en este dispositivo.</span>
      </span>
      <button className={s.retry} onClick={retryFailed}>
        Reintentar
      </button>
      <button className={`${s.dismiss} material-symbols-rounded`} title="Cerrar" onClick={dismissFailed}>
        close
      </button>
    </div>
  );
}
