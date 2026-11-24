"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { maskAmountInput, parseAmount, toDecimal, toInput } from "@/lib/money";
import type { AccountDto } from "@/lib/dto";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { VIEWS } from "@/lib/nav";
import { ACCOUNT_KINDS, kindColor, kindTint } from "./kinds";
import t from "@/components/tx/tx.module.css";
import a from "./accounts.module.css";

/** Panel de una cuenta: editar nombre, tipo y saldo, ver sus movimientos o eliminarla. */
export function AccountSheet({ account, onClose }: { account: AccountDto; onClose: () => void }) {
  const router = useRouter();
  const { flash, setMovAccount } = useShell();
  const { updateAccount, deleteAccount } = useData();
  const [name, setName] = useState(account.name);
  const [kind, setKind] = useState(account.kind);
  const negative = Number(account.balance) < 0;
  const [balance, setBalance] = useState(toInput(Math.abs(Number(account.balance))));
  const [isNegative, setIsNegative] = useState(negative);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!name.trim()) return setErr("Poné un nombre para la cuenta");
    setBusy(true);
    const value = parseAmount(balance) * (isNegative ? -1 : 1);
    const ok = await updateAccount(account.id, { name: name.trim(), kind, balance: toDecimal(value) });
    setBusy(false);
    if (ok) {
      flash("Cuenta actualizada");
      onClose();
    }
  };

  const remove = async () => {
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    const ok = await deleteAccount(account.id);
    setBusy(false);
    if (ok) {
      flash("Cuenta eliminada");
      onClose();
    }
  };

  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 32 }}>
      <div className={`${t.sheet} ${t.detail}`} role="dialog" aria-modal="true" aria-label={`Cuenta ${account.name}`} onClick={(e) => e.stopPropagation()}>
        <div className={t.glow} />
        <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
          close
        </button>
        <span className={`${t.bigIcon} material-symbols-rounded`} style={{ background: kindTint(kind), color: kindColor(kind), borderRadius: 24 }}>
          {ACCOUNT_KINDS[kind].icon}
        </span>
        <input className={t.descInline} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" maxLength={60} />
        <div className={t.detailAmount}>
          <button className={t.curBtn} title="Saldo negativo (descubierto)" onClick={() => setIsNegative((n) => !n)}>
            {isNegative ? "−" : ""}
            {account.currency === "USD" ? "US$" : "$"}
          </button>
          <input
            className={t.amount}
            style={isNegative ? { color: "var(--red)" } : undefined}
            value={balance}
            inputMode="decimal"
            aria-label="Saldo actual"
            onChange={(e) => setBalance(maskAmountInput(e.target.value))}
          />
        </div>
        <div className={t.meta}>Cambiar el saldo a mano lo ajusta sin crear un movimiento.</div>

        <div className={a.sheetFields}>
          <label className={a.field}>
            Tipo
            <select className={a.input} value={kind} onChange={(e) => setKind(e.target.value as AccountDto["kind"])}>
              {Object.entries(ACCOUNT_KINDS).map(([v, k]) => (
                <option key={v} value={v}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className={a.field}>
            Moneda
            <input className={a.input} value={account.currency === "USD" ? "Dólares" : "Pesos"} disabled />
          </label>
        </div>
        {err && <div className={t.error}>{err}</div>}

        <button
          className={a.ghost}
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => {
            setMovAccount(account.id);
            onClose();
            router.push(VIEWS.mov.href);
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
            receipt_long
          </span>
          Ver movimientos
        </button>

        <div className={t.actions}>
          <button className={t.delete} data-confirm={confirmDel} onClick={remove} disabled={busy}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              delete
            </span>
            {confirmDel ? "¿Seguro?" : "Eliminar"}
          </button>
          <button className={t.primary} onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
