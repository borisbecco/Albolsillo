"use client";

import { useEffect, useState } from "react";
import { maskAmountInput, parseAmount, toDecimal, toInput } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import d from "./debts.module.css";

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const dayOk = (v: string) => Number(v) >= 1 && Number(v) <= 31;

/** Alta o edición de un préstamo (id null = nuevo). */
export function LoanSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { flash } = useShell();
  const { loans, saveLoan, deleteLoan } = useData();
  const loan = id ? loans.find((l) => l.id === id) : null;

  const [name, setName] = useState(loan?.name ?? "");
  const [installment, setInstallment] = useState(loan ? toInput(loan.installment) : "");
  const [n, setN] = useState(loan ? String(loan.n) : "0");
  const [of, setOf] = useState(loan ? String(loan.of) : "12");
  const [due, setDue] = useState(loan ? String(loan.due_day) : "10");
  const [tna, setTna] = useState(loan ? String(Number(loan.tna)) : "");
  const [balance, setBalance] = useState(loan && Number(loan.balance) ? toInput(loan.balance) : "");
  const [balanceTouched, setBalanceTouched] = useState(!!loan);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Saldo sugerido: cuotas que faltan × valor de la cuota (se puede corregir).
  const suggested = Math.max(0, Number(of) - Number(n)) * parseAmount(installment);
  const balanceShown = balanceTouched ? balance : suggested ? toInput(Math.round(suggested)) : "";

  const save = async () => {
    if (!name.trim()) return setErr("Poné un nombre al préstamo");
    if (!parseAmount(installment)) return setErr("Poné el valor de la cuota");
    if (!Number(of)) return setErr("Poné la cantidad de cuotas");
    if (Number(n) > Number(of)) return setErr("Las cuotas pagadas no pueden ser más que el total");
    if (!dayOk(due)) return setErr("El día va de 1 a 31");
    setBusy(true);
    const ok = await saveLoan(id, {
      name: name.trim(),
      installment: toDecimal(parseAmount(installment)),
      n: Number(n),
      of: Number(of),
      due_day: Number(due),
      tna: String(Math.min(999, parseAmount(tna))),
      balance: toDecimal(parseAmount(balanceShown)),
    });
    setBusy(false);
    if (ok) {
      flash(id ? "Préstamo actualizado" : "Préstamo agregado");
      onClose();
    }
  };

  const remove = async () => {
    if (!id) return;
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    const ok = await deleteLoan(id);
    setBusy(false);
    if (ok) {
      flash("Préstamo eliminado");
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
      <div className={`${t.sheet} ${t.detail}`} role="dialog" aria-modal="true" aria-label={id ? `Préstamo ${loan?.name}` : "Nuevo préstamo"} onClick={(e) => e.stopPropagation()}>
        <div className={t.glow} />
        <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
          close
        </button>
        <span className={d.sheetTitle}>{id ? "Editar préstamo" : "Nuevo préstamo"}</span>
        <div className={d.fields}>
          <label className={`${d.field} ${d.full}`}>
            Nombre
            <input className={d.input} value={name} onChange={(e) => edit(setName)(e.target.value)} placeholder="Ej. Préstamo personal Santander" maxLength={60} autoFocus={!id} />
          </label>
          <label className={d.field}>
            Cuota
            <input className={d.input} value={installment} onChange={(e) => edit(setInstallment)(maskAmountInput(e.target.value))} inputMode="decimal" placeholder="0" />
          </label>
          <label className={d.field}>
            Vence (día)
            <input className={d.input} value={due} onChange={(e) => edit(setDue)(digits(e.target.value, 2))} inputMode="numeric" />
          </label>
          <label className={d.field}>
            Cuotas pagadas
            <input className={d.input} value={n} onChange={(e) => edit(setN)(digits(e.target.value, 3))} inputMode="numeric" />
          </label>
          <label className={d.field}>
            Total de cuotas
            <input className={d.input} value={of} onChange={(e) => edit(setOf)(digits(e.target.value, 3))} inputMode="numeric" />
          </label>
          <label className={d.field}>
            TNA %
            <input className={d.input} value={tna} onChange={(e) => edit(setTna)(maskAmountInput(e.target.value))} inputMode="decimal" placeholder="0" />
          </label>
          <label className={d.field}>
            Saldo restante
            <input
              className={d.input}
              value={balanceShown}
              onChange={(e) => {
                setErr("");
                setBalance(maskAmountInput(e.target.value));
                setBalanceTouched(true);
              }}
              inputMode="decimal"
              placeholder="0"
            />
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
            {busy ? "Guardando…" : id ? "Guardar cambios" : "Agregar préstamo"}
          </button>
        </div>
      </div>
    </div>
  );
}
