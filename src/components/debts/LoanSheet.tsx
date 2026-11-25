"use client";

import { useEffect, useState } from "react";
import { formatMoney, maskAmountEvent, parseAmount, toDecimal, toInput } from "@/lib/money";
import { findEntity } from "@/lib/entities";
import { EntityCombo } from "./EntityCombo";
import { MONTH_FULL, currentMonth, todayAR } from "@/lib/month";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import d from "./debts.module.css";
import { dayOk, digits } from "@/lib/inputs";


/** Alta o edición de un préstamo (id null = nuevo). */
export function LoanSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { flash } = useShell();
  const { loans, saveLoan, deleteLoan } = useData();
  const loan = id ? loans.find((l) => l.id === id) : null;

  const [lender, setLender] = useState(loan?.lender ?? findEntity(loan?.name)?.name ?? "");
  const [name, setName] = useState(loan?.name ?? "");
  const [installment, setInstallment] = useState(loan ? toInput(loan.installment) : "");
  const [n, setN] = useState(loan ? String(loan.n) : "0");
  const [of, setOf] = useState(loan ? String(loan.of) : "");
  const [due, setDue] = useState(loan ? String(loan.due_day) : "10");
  const [tna, setTna] = useState(loan ? String(Number(loan.tna)) : "");
  const [balance, setBalance] = useState(loan && Number(loan.balance) ? toInput(loan.balance) : "");
  // El saldo se calcula solo (cuotas que faltan × cuota) hasta que lo escribís a mano.
  // Al editar se muestra el guardado, pero si cambiás cuota o cuotas se vuelve a calcular.
  const [balanceTouched, setBalanceTouched] = useState(false);
  const [termsChanged, setTermsChanged] = useState(!loan);
  // Si el vencimiento de este mes ya pasó, preguntamos si esa cuota ya está paga
  // (si no, un préstamo recién cargado aparece como vencido).
  const month = currentMonth();
  const paidAlready = loan?.last_paid_month === month;
  const [paidThisMonth, setPaidThisMonth] = useState(!loan);
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
  const balanceShown = balanceTouched || !termsChanged ? balance : suggested ? toInput(Math.round(suggested)) : "";
  const left = Math.max(0, Number(of) - Number(n));
  const askPaid = !paidAlready && dayOk(due) && Number(due) <= Number(todayAR().slice(8)) && Number(n) > 0 && left > 0;
  const remaining = left * parseAmount(installment);
  // El saldo de capital nunca debería superar lo que falta pagar en cuotas.
  const balanceOff = left > 0 && remaining > 0 && parseAmount(balanceShown) > remaining * 1.05;
  const terms =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      setErr("");
      setTermsChanged(true);
      fn(v);
    };

  const save = async () => {
    if (!name.trim()) return setErr("Poné un nombre al préstamo");
    if (!parseAmount(installment)) return setErr("Poné el valor de la cuota");
    if (!Number(of)) return setErr("Poné la cantidad de cuotas");
    if (Number(n) > Number(of)) return setErr("Las cuotas pagadas no pueden ser más que el total");
    if (!dayOk(due)) return setErr("El día va de 1 a 31");
    setBusy(true);
    const ok = await saveLoan(id, {
      lender: lender.trim() || null,
      name: name.trim(),
      installment: toDecimal(parseAmount(installment)),
      n: Number(n),
      of: Number(of),
      due_day: Number(due),
      tna: String(Math.min(999, parseAmount(tna))),
      balance: toDecimal(parseAmount(balanceShown)),
      ...(askPaid && { paid_this_month: paidThisMonth }),
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
      <div className={`${t.sheet} ${t.detail}`} role="dialog" aria-modal="true" aria-label={id ? `Préstamo ${loan?.name}` : "Nuevo préstamo"} onClick={(e) => e.stopPropagation()}>
        <div className={t.glow} />
        <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
          close
        </button>
        <span className={d.sheetTitle}>{id ? "Editar préstamo" : "Nuevo préstamo"}</span>
        <div className={d.fields}>
          <div className={`${d.field} ${d.full}`}>
            Entidad
            <EntityCombo
              value={lender}
              onChange={(v) => {
                setErr("");
                // Si el nombre lo habíamos armado con la entidad anterior, lo actualizamos.
                if (v && (!name.trim() || name === `Préstamo ${lender}`)) setName(`Préstamo ${v}`);
                setLender(v);
              }}
            />
          </div>
          <label className={`${d.field} ${d.full}`}>
            Nombre
            <input className={d.input} value={name} onChange={(e) => edit(setName)(e.target.value)} placeholder="Ej. Préstamo personal" maxLength={60} />
          </label>
          <label className={d.field}>
            Cuota mensual
            <input className={d.input} value={installment} onChange={(e) => terms(setInstallment)(maskAmountEvent(e))} inputMode="decimal" placeholder="0" />
          </label>
          <label className={d.field}>
            Día de vencimiento
            <input className={d.input} value={due} onChange={(e) => edit(setDue)(digits(e.target.value, 2))} inputMode="numeric" />
          </label>
          <label className={d.field}>
            Cuotas en total
            <input className={d.input} value={of} onChange={(e) => terms(setOf)(digits(e.target.value, 3))} inputMode="numeric" placeholder="24" />
          </label>
          <label className={d.field}>
            Cuotas ya pagadas
            <input className={d.input} value={n} onChange={(e) => terms(setN)(digits(e.target.value, 3))} inputMode="numeric" />
          </label>
          <label className={d.field}>
            TNA (opcional)
            <input className={d.input} value={tna} onChange={(e) => edit(setTna)(maskAmountEvent(e))} inputMode="decimal" placeholder="%" />
          </label>
          <label className={d.field}>
            Saldo restante
            <input
              className={d.input}
              value={balanceShown}
              onChange={(e) => {
                setErr("");
                setBalance(maskAmountEvent(e));
                setBalanceTouched(true);
              }}
              inputMode="decimal"
              placeholder="0"
            />
          </label>
        </div>
        {parseAmount(installment) > 0 && Number(of) > 0 && (
          <p className={d.hint}>
            {left
              ? `Faltan ${left} ${left === 1 ? "cuota" : "cuotas"} de ${formatMoney(parseAmount(installment), "ARS")} · ${formatMoney(left * parseAmount(installment), "ARS")} en total`
              : "Ya están todas las cuotas pagadas"}
          </p>
        )}
        {balanceOff && (
          <p className={d.hint} style={{ color: "var(--red)" }}>
            El saldo ({formatMoney(parseAmount(balanceShown), "ARS")}) es mayor que lo que te falta pagar ({formatMoney(remaining, "ARS")}). Revisá la cuota o el saldo.
          </p>
        )}
        {askPaid && (
          <label className={d.check}>
            <input type="checkbox" checked={paidThisMonth} onChange={(e) => setPaidThisMonth(e.target.checked)} />
            Ya pagué la cuota de {MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase()} (ya la conté entre las pagadas)
          </label>
        )}
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
