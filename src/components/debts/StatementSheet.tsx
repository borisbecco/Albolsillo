"use client";

import { useEffect, useState } from "react";
import { maskAmountEvent, parseAmount, toDecimal } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import t from "@/components/tx/tx.module.css";
import d from "./debts.module.css";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);
const dayOk = (v: string) => Number(v) >= 1 && Number(v) <= 31;

/** Cargar el resumen nuevo de una tarjeta: cierra el ciclo. */
export function StatementSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { cards, loadStatement } = useData();
  const card = cards.find((c) => c.id === id);
  const [bal, setBal] = useState("");
  const [min, setMin] = useState("");
  const [usd, setUsd] = useState("");
  const [close, setClose] = useState(card ? String(card.close_day) : "");
  const [due, setDue] = useState(card ? String(card.due_day) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!card) return null;

  const save = async () => {
    if (!bal.trim()) return setErr("Poné el saldo a pagar del resumen");
    if (!dayOk(close) || !dayOk(due)) return setErr("Los días van de 1 a 31");
    setBusy(true);
    const n = await loadStatement(card.id, {
      balance: toDecimal(parseAmount(bal)),
      balance_usd: toDecimal(parseAmount(usd)),
      minimum: toDecimal(parseAmount(min)),
      close_day: Number(close),
      due_day: Number(due),
    });
    setBusy(false);
    if (n === null) return;
    // El aviso (con Deshacer) lo muestra loadStatement.
    onClose();
  };

  const set = (fn: (v: string) => void) => (v: string) => {
    setErr("");
    fn(v);
  };

  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 32 }}>
      <div className={t.sheet} role="dialog" aria-modal="true" aria-label="Resumen nuevo" onClick={(e) => e.stopPropagation()}>
        <div className={t.top}>
          <span className={d.sheetTitle}>Resumen nuevo</span>
          <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
            close
          </button>
        </div>
        <p className={d.hint} style={{ margin: 0, color: "var(--fg)", fontSize: 14 }}>
          Copiá los datos del último resumen de {card.name}.
        </p>
        <div className={d.fields}>
          <label className={d.field}>
            Saldo a pagar
            <input className={d.input} value={bal} onChange={(e) => set(setBal)(maskAmountEvent(e))} inputMode="decimal" placeholder="$ 0" autoFocus />
          </label>
          <label className={d.field}>
            Pago mínimo
            <input className={d.input} value={min} onChange={(e) => set(setMin)(maskAmountEvent(e))} inputMode="decimal" placeholder="$ 0" />
          </label>
          <label className={d.field}>
            Día de cierre
            <input className={d.input} value={close} onChange={(e) => set(setClose)(digits(e.target.value))} inputMode="numeric" />
          </label>
          <label className={d.field}>
            Día de vencimiento
            <input className={d.input} value={due} onChange={(e) => set(setDue)(digits(e.target.value))} inputMode="numeric" />
          </label>
          <label className={`${d.field} ${d.full}`}>
            Saldo en dólares (si tiene)
            <input className={d.input} value={usd} onChange={(e) => set(setUsd)(maskAmountEvent(e))} inputMode="decimal" placeholder="US$ 0" />
          </label>
        </div>
        <p className={d.hint}>
          Lo pagado del resumen anterior vuelve a cero y las cuotas sin interés avanzan un mes. Si tenés el PDF, también podés importarlo desde Importar resumen.
        </p>
        {err && (
          <div className={t.error} role="alert">
            {err}
          </div>
        )}
        <button className={t.primary} onClick={save} disabled={busy}>
          {busy ? "Guardando…" : "Guardar resumen"}
        </button>
      </div>
    </div>
  );
}
