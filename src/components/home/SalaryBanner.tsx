"use client";

import { useState } from "react";
import { formatMoney, maskAmountEvent, parseAmount, toDecimal, toInput } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { todayAR } from "@/components/tx/parts";
import a from "@/components/auto/auto.module.css";
import h from "./dashboard.module.css";

const dismissKey = (month: string) => `ab-sueldo-${month}`;
const readDismissed = (month: string) => {
  try {
    return localStorage.getItem(dismissKey(month)) === "1";
  } catch {
    return false;
  }
};

/**
 * Desde el día de cobro, si todavía no cargaste el sueldo del mes:
 * "Cobraste el sueldo · sumar $ X a Galicia" con un toque (monto y cuenta editables).
 */
export function SalaryBanner() {
  const { user, flash } = useShell();
  const { transactions, accounts, createTx } = useData();
  const today = todayAR();
  const month = today.slice(0, 7);
  const cur = user.salary_currency ?? "ARS";
  const options = accounts.filter((x) => x.currency === cur);
  const [amount, setAmount] = useState(() => (Number(user.salary) ? toInput(user.salary!) : ""));
  const [acc, setAcc] = useState(() => (options.some((x) => x.id === user.salary_account_id) ? user.salary_account_id! : (options[0]?.id ?? "")));
  const [dismissed, setDismissed] = useState(() => readDismissed(month));
  const [busy, setBusy] = useState(false);

  if (!Number(user.salary) || !user.payday || dismissed) return null;
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  if (Number(today.slice(8)) < Math.min(user.payday, lastDay)) return null;
  if (transactions.some((t) => t.type === "in" && t.category_id === "sueldo" && t.date.startsWith(month))) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(month), "1");
    } catch {}
    setDismissed(true);
  };

  const add = async () => {
    const value = parseAmount(amount);
    if (!value) return flash("Poné el monto que cobraste", "errorguardar");
    setBusy(true);
    await createTx({ type: "in", date: today, description: "Sueldo", category_id: "sueldo", amount: toDecimal(value), currency: cur, account_id: acc || null, card_id: null, recurring: false });
    setBusy(false);
    const name = accounts.find((x) => x.id === acc)?.name;
    flash(`Sumamos ${formatMoney(value, cur)}${name ? ` a ${name}` : ""}`, "ingreso");
  };

  return (
    <div className={`${a.banner} ${h.salary}`} role="region" aria-label="Sueldo del mes">
      <span className={`${a.bannerIcon} material-symbols-rounded`}>payments</span>
      <span className={a.bannerText}>
        <strong>{Number(today.slice(8)) === Math.min(user.payday, lastDay) ? "Hoy cobrás el sueldo" : "¿Ya cobraste el sueldo?"}</strong>
        <span>Confirmalo y lo sumamos a tu cuenta.</span>
      </span>
      <div className={h.salaryForm}>
        <input className={h.salaryInput} value={amount} onChange={(e) => setAmount(maskAmountEvent(e))} inputMode="decimal" aria-label="Monto cobrado" />
        {options.length > 0 && (
          <select className={h.salaryInput} value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Cuenta">
            {options.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        )}
        <button className={a.bannerBtn} onClick={add} disabled={busy}>
          {busy ? "Sumando…" : "Sumar"}
        </button>
        <button className={`${h.salaryClose} material-symbols-rounded`} onClick={dismiss} title="Ahora no" aria-label="Ahora no">
          close
        </button>
      </div>
    </div>
  );
}
