"use client";

import { useEffect, useState } from "react";
import { detectBank, detectNetwork, estimateCloseDay } from "@/lib/banks";
import { maskAmountInput, parseAmount, toDecimal, toInput } from "@/lib/money";
import { CardFace } from "@/components/cards/CardFace";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import d from "./debts.module.css";

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const dayOk = (v: string) => Number(v) >= 1 && Number(v) <= 31;

/** Alta o edición de una tarjeta de crédito (id null = nueva). */
export function CardSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { month, flash } = useShell();
  const { cards, saveCard, deleteCard } = useData();
  const card = id ? cards.find((c) => c.id === id) : null;

  const [name, setName] = useState(card?.name ?? "");
  const [balance, setBalance] = useState(card && Number(card.balance) ? toInput(card.balance) : "");
  const [min, setMin] = useState(card && Number(card.min_payment) ? toInput(card.min_payment) : "");
  const [due, setDue] = useState(card ? String(card.due_day) : "20");
  const [close, setClose] = useState(card ? String(card.close_day) : "");
  const [tna, setTna] = useState(card ? String(Number(card.tna)) : "110");
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!name.trim()) return setErr("Poné un nombre a la tarjeta (ej. Visa Galicia)");
    if (!dayOk(due)) return setErr("El vencimiento va de 1 a 31");
    if (close && !dayOk(close)) return setErr("El cierre va de 1 a 31");
    if (last4 && last4.length !== 4) return setErr("Los últimos 4 son 4 números");
    setBusy(true);
    const ok = await saveCard(id, {
      name: name.trim(),
      balance: toDecimal(parseAmount(balance)),
      min_payment: toDecimal(parseAmount(min)),
      due_day: Number(due),
      close_day: close ? Number(close) : estimateCloseDay(Number(due)),
      tna: String(Math.min(999, parseAmount(tna))),
      last4: last4 || null,
    });
    setBusy(false);
    if (ok) {
      flash(id ? "Tarjeta actualizada" : "Tarjeta agregada");
      onClose();
    }
  };

  const remove = async () => {
    if (!id) return;
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    const ok = await deleteCard(id);
    setBusy(false);
    if (ok) {
      flash("Tarjeta eliminada");
      onClose();
    }
  };

  const edit =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      setErr("");
      fn(v);
    };

  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 32 }}>
      <div className={`${t.sheet} ${t.detail}`} role="dialog" aria-modal="true" aria-label={id ? `Tarjeta ${card?.name}` : "Nueva tarjeta"} onClick={(e) => e.stopPropagation()}>
        <div className={t.glow} />
        <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
          close
        </button>
        <span className={d.sheetTitle}>{id ? "Editar tarjeta" : "Nueva tarjeta"}</span>
        <div className={d.facePreview}>
          <CardFace
            name={name}
            bank={detectBank(name)}
            network={detectNetwork(name)}
            balance={parseAmount(balance)}
            last4={last4}
            dueDay={dayOk(due) ? Number(due) : null}
            index={cards.findIndex((c) => c.id === id) + (id ? 0 : cards.length + 1)}
            month={month}
          />
        </div>
        <div className={d.fields}>
          <label className={`${d.field} ${d.full}`}>
            Nombre
            <input className={d.input} value={name} onChange={(e) => edit(setName)(e.target.value)} placeholder="Ej. Visa Galicia" maxLength={60} autoFocus={!id} />
          </label>
          <label className={d.field}>
            Saldo a pagar
            <input className={d.input} value={balance} onChange={(e) => edit(setBalance)(maskAmountInput(e.target.value))} inputMode="decimal" placeholder="0" />
          </label>
          <label className={d.field}>
            Pago mínimo
            <input className={d.input} value={min} onChange={(e) => edit(setMin)(maskAmountInput(e.target.value))} inputMode="decimal" placeholder="0" />
          </label>
          <label className={d.field}>
            Cierre (día)
            <input
              className={d.input}
              value={close}
              onChange={(e) => edit(setClose)(digits(e.target.value, 2))}
              inputMode="numeric"
              placeholder={dayOk(due) ? String(estimateCloseDay(Number(due))) : ""}
            />
          </label>
          <label className={d.field}>
            Vence (día)
            <input className={d.input} value={due} onChange={(e) => edit(setDue)(digits(e.target.value, 2))} inputMode="numeric" />
          </label>
          <label className={d.field}>
            TNA %
            <input className={d.input} value={tna} onChange={(e) => edit(setTna)(maskAmountInput(e.target.value))} inputMode="decimal" />
          </label>
          <label className={d.field}>
            Últimos 4
            <input className={d.input} value={last4} onChange={(e) => edit(setLast4)(digits(e.target.value, 4))} inputMode="numeric" placeholder="0000" />
          </label>
        </div>
        {err && (
          <div className={t.error} role="alert">
            {err}
          </div>
        )}
        <div className={t.actions}>
          {id && (
            <button className={t.delete} data-confirm={confirmDel} onClick={remove} disabled={busy}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                delete
              </span>
              {confirmDel ? "¿Seguro?" : "Eliminar"}
            </button>
          )}
          <button className={t.primary} onClick={save} disabled={busy}>
            {busy ? "Guardando…" : id ? "Guardar cambios" : "Agregar tarjeta"}
          </button>
        </div>
      </div>
    </div>
  );
}
