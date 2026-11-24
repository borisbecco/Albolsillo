"use client";

import { useEffect, useState } from "react";
import { entityDomain } from "@/lib/entities";
import { maskAmountEvent, parseAmount, toDecimal, toInput } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { ACCOUNT_KINDS } from "@/components/accounts/kinds";
import { Logo } from "@/components/shell/Logo";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import d from "./debts.module.css";

/** Pagar la cuota de un préstamo: monto (prellenado) y cuenta de origen. */
export function LoanPaySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { month, flash } = useShell();
  const { loans, accounts, payLoan, unpayLoan } = useData();
  const loan = loans.find((l) => l.id === id);
  const pesos = accounts.filter((a) => a.currency === "ARS");
  const [amount, setAmount] = useState(loan ? toInput(loan.installment) : "");
  const [acc, setAcc] = useState<string | null>(pesos[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!loan) return null;

  const save = async () => {
    const value = parseAmount(amount);
    if (!value) return setErr("Poné el monto que pagaste");
    setBusy(true);
    const ok = await payLoan(loan.id, month, { amount: toDecimal(value), account_id: acc });
    setBusy(false);
    if (!ok) return;
    onClose();
    const n = loan.n + 1;
    const fin = n >= loan.of;
    flash(fin ? `¡Terminaste de pagar ${loan.name}!` : `Cuota ${n} de ${loan.of} pagada`, fin ? "meta" : "ingreso", {
      label: "Deshacer",
      fn: async () => {
        if (await unpayLoan(loan.id)) flash("Anulamos el pago");
      },
    });
  };

  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 32 }}>
      <div className={t.sheet} role="dialog" aria-modal="true" aria-label="Pagar cuota" onClick={(e) => e.stopPropagation()}>
        <div className={t.top}>
          <span className={d.sheetTitle}>Pagar cuota</span>
          <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
            close
          </button>
        </div>
        <div className={d.payHead}>
          <strong>{loan.name}</strong>
          <span>
            Cuota {loan.n + 1} de {loan.of} · vence el {loan.due_day}
          </span>
        </div>
        <label className={d.payAmount}>
          <span>$</span>
          <input
            value={amount}
            onChange={(e) => {
              setErr("");
              setAmount(maskAmountEvent(e));
            }}
            inputMode="decimal"
            aria-label="Monto"
            autoFocus
          />
        </label>
        {pesos.length > 0 && (
          <div className={d.payFrom}>
            <span>Sale de</span>
            <div className={d.payAccs}>
              {pesos.map((a) => (
                <button key={a.id} className={d.payAcc} aria-pressed={acc === a.id} onClick={() => setAcc(acc === a.id ? null : a.id)}>
                  <Logo domain={a.kind === "efectivo" ? null : entityDomain(a.name)} icon={ACCOUNT_KINDS[a.kind].icon} size={26} />
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className={d.hint}>Cuenta como gasto del mes en la categoría Préstamos{acc ? " y se descuenta de la cuenta" : ""}.</p>
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
