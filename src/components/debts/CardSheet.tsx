"use client";

import { useEffect, useState } from "react";
import { detectBank, detectNetwork, estimateCloseDay } from "@/lib/banks";
import { maskAmountEvent, parseAmount, toDecimal, toInput } from "@/lib/money";
import { findEntity, sortedEntities } from "@/lib/entities";
import { CardFace } from "@/components/cards/CardFace";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import d from "./debts.module.css";

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const dayOk = (v: string) => Number(v) >= 1 && Number(v) <= 31;

const NETWORKS = [
  ["visa", "Visa"],
  ["master", "Mastercard"],
  ["amex", "Amex"],
] as const;
type Net = (typeof NETWORKS)[number][0];
const netLabel = (n: Net) => NETWORKS.find((x) => x[0] === n)![1];
/** Lo que queda del nombre sin la red ("Visa Galicia" → "Galicia"). */
const stripNetwork = (name: string) => name.replace(/visa|mastercard|master|amex|american express/gi, "").trim();

/** Alta o edición de una tarjeta de crédito (id null = nueva). */
export function CardSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { month, flash } = useShell();
  const { cards, saveCard, deleteCard } = useData();
  const card = id ? cards.find((c) => c.id === id) : null;

  // El nombre se arma como "Red + Banco" (o el nombre libre si eligió "Otra").
  const [issuer, setIssuer] = useState(card ? (findEntity(card.name)?.name ?? "Otra") : "");
  const [other, setOther] = useState(card && !findEntity(card.name) ? stripNetwork(card.name) : "");
  const [net, setNet] = useState<Net>(card ? detectNetwork(card.name) : "visa");
  const name = issuer ? `${netLabel(net)} ${issuer === "Otra" ? other.trim() : issuer}`.trim() : "";
  const [balance, setBalance] = useState(card && Number(card.balance) ? toInput(card.balance) : "");
  const [min, setMin] = useState(card && Number(card.min_payment) ? toInput(card.min_payment) : "");
  const [usd, setUsd] = useState(card && Number(card.balance_usd) ? toInput(card.balance_usd) : "");
  const [due, setDue] = useState(card ? String(card.due_day) : "20");
  const [close, setClose] = useState(card ? String(card.close_day) : "");
  const [tna, setTna] = useState(card && Number(card.tna) ? String(Number(card.tna)) : "");
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
    if (!issuer) return setErr("Elegí quién emite la tarjeta");
    if (issuer === "Otra" && !other.trim()) return setErr("Escribí el nombre del banco o la billetera");
    if (!dayOk(due)) return setErr("El vencimiento va de 1 a 31");
    if (close && !dayOk(close)) return setErr("El cierre va de 1 a 31");
    if (last4 && last4.length !== 4) return setErr("Los últimos 4 son 4 números");
    setBusy(true);
    const ok = await saveCard(id, {
      name: name.trim(),
      balance: toDecimal(parseAmount(balance)),
      balance_usd: toDecimal(parseAmount(usd)),
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
    if (ok) onClose();
  };

  const edit =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      setErr("");
      fn(v);
    };

  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 32 }}>
      <div className={t.sheet} role="dialog" aria-modal="true" aria-label={id ? `Tarjeta ${card?.name}` : "Nueva tarjeta"} onClick={(e) => e.stopPropagation()}>
        <div className={t.top}>
          <span className={d.sheetTitle}>{id ? "Editar tarjeta" : "Nueva tarjeta"}</span>
          <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
            close
          </button>
        </div>
        <div className={d.facePreview}>
          <CardFace
            name={name}
            bank={detectBank(name)}
            network={net}
            balance={parseAmount(balance)}
            usd={parseAmount(usd)}
            last4={last4}
            dueDay={dayOk(due) ? Number(due) : null}
            index={cards.findIndex((c) => c.id === id) + (id ? 0 : cards.length + 1)}
            month={month}
          />
        </div>
        <div className={d.fields}>
          <label className={`${d.field} ${d.full}`}>
            Banco o billetera
            <select
              className={d.input}
              value={issuer}
              onChange={(e) => {
                setErr("");
                setIssuer(e.target.value);
              }}
              autoFocus={!id}
            >
              <option value="">Elegí quién emite la tarjeta</option>
              <optgroup label="Bancos">
                {sortedEntities("banco").map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Billeteras">
                {sortedEntities("billetera").map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
              <option value="Otra">Otra</option>
            </select>
          </label>
          {issuer === "Otra" && (
            <label className={`${d.field} ${d.full}`}>
              Nombre del banco o billetera
              <input className={d.input} value={other} onChange={(e) => edit(setOther)(e.target.value)} placeholder="Ej. Cencosud" maxLength={40} />
            </label>
          )}
          <div className={`${d.field} ${d.full} ${d.netRow}`}>
            <span>Red</span>
            <div className={d.segTabs} role="group" aria-label="Red">
              {NETWORKS.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={net === v} onClick={() => setNet(v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <label className={d.field}>
            Últimos 4 números
            <input className={d.input} value={last4} onChange={(e) => edit(setLast4)(digits(e.target.value, 4))} inputMode="numeric" placeholder="0000" />
          </label>
          <label className={d.field}>
            TNA (opcional)
            <input className={d.input} value={tna} onChange={(e) => edit(setTna)(maskAmountEvent(e))} inputMode="decimal" placeholder="%" />
          </label>
          <label className={d.field}>
            Saldo en pesos
            <input className={d.input} value={balance} onChange={(e) => edit(setBalance)(maskAmountEvent(e))} inputMode="decimal" placeholder="$ 0" />
          </label>
          <label className={d.field}>
            Saldo en dólares
            <input className={d.input} value={usd} onChange={(e) => edit(setUsd)(maskAmountEvent(e))} inputMode="decimal" placeholder="US$ 0" />
          </label>
          <label className={d.field}>
            Pago mínimo
            <input className={d.input} value={min} onChange={(e) => edit(setMin)(maskAmountEvent(e))} inputMode="decimal" placeholder="$ 0" />
          </label>
          <span />
          <label className={d.field}>
            Día de cierre
            <input
              className={d.input}
              value={close}
              onChange={(e) => edit(setClose)(digits(e.target.value, 2))}
              inputMode="numeric"
              placeholder={dayOk(due) ? String(estimateCloseDay(Number(due))) : ""}
            />
          </label>
          <label className={d.field}>
            Día de vencimiento
            <input className={d.input} value={due} onChange={(e) => edit(setDue)(digits(e.target.value, 2))} inputMode="numeric" />
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
