"use client";

import { useState } from "react";
import { formatMoney, maskAmountEvent, parseAmount, toDecimal, toInput, type Currency } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { todayAR } from "@/components/tx/parts";
import a from "@/components/auto/auto.module.css";
import h from "./dashboard.module.css";

type Income = { id: "sueldo" | "otros_in"; title: string; amount: number; currency: Currency; day: number; accountId: string | null; description: string };

const dismissKey = (id: string, month: string) => (id === "sueldo" ? `ab-sueldo-${month}` : `ab-ingreso-${id}-${month}`);
const readDismissed = (id: string, month: string) => {
  try {
    return localStorage.getItem(dismissKey(id, month)) === "1";
  } catch {
    return false;
  }
};

/**
 * Desde el día de cobro, si todavía no cargaste el sueldo (u otros ingresos) del mes:
 * "¿Ya cobraste? sumar $ X a Galicia" con un toque (monto y cuenta editables).
 */
export function SalaryBanner() {
  const { user } = useShell();
  const { transactions } = useData();
  const today = todayAR();
  const month = today.slice(0, 7);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();

  const incomes: Income[] = [];
  if (Number(user.salary) && user.payday) {
    incomes.push({ id: "sueldo", title: "el sueldo", amount: Number(user.salary), currency: user.salary_currency ?? "ARS", day: user.payday, accountId: user.salary_account_id, description: "Sueldo" });
  }
  // Otros ingresos: solo si tienen día (sin día no sabemos cuándo proponerlos).
  if (Number(user.usd_income) && user.other_income_day) {
    incomes.push({
      id: "otros_in",
      title: "tus otros ingresos",
      amount: Number(user.usd_income),
      currency: user.other_income_currency ?? "USD",
      day: user.other_income_day,
      accountId: user.other_income_account_id,
      description: "Otros ingresos",
    });
  }
  const due = incomes.filter(
    (i) => Number(today.slice(8)) >= Math.min(i.day, lastDay) && !transactions.some((t) => t.type === "in" && t.category_id === i.id && t.date.startsWith(month)),
  );
  if (!due.length) return null;
  return (
    <>
      {due.map((i) => (
        <IncomeRow key={i.id} income={i} today={today} isToday={Number(today.slice(8)) === Math.min(i.day, lastDay)} />
      ))}
    </>
  );
}

function IncomeRow({ income, today, isToday }: { income: Income; today: string; isToday: boolean }) {
  const { flash } = useShell();
  const { accounts, createTx } = useData();
  const month = today.slice(0, 7);
  const options = accounts.filter((x) => x.currency === income.currency);
  const [amount, setAmount] = useState(() => toInput(income.amount));
  const [acc, setAcc] = useState(() => (options.some((x) => x.id === income.accountId) ? income.accountId! : (options[0]?.id ?? "")));
  const [dismissed, setDismissed] = useState(() => readDismissed(income.id, month));
  const [busy, setBusy] = useState(false);
  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(income.id, month), "1");
    } catch {}
    setDismissed(true);
  };

  const add = async () => {
    const value = parseAmount(amount);
    if (!value) return flash("Poné el monto que cobraste", "errorguardar");
    setBusy(true);
    await createTx({ type: "in", date: today, description: income.description, category_id: income.id, amount: toDecimal(value), currency: income.currency, account_id: acc || null, card_id: null, recurring: false });
    setBusy(false);
    const name = accounts.find((x) => x.id === acc)?.name;
    flash(`Sumamos ${formatMoney(value, income.currency)}${name ? ` a ${name}` : ""}`, "ingreso");
  };

  return (
    <div className={`${a.banner} ${h.salary}`} role="region" aria-label={income.id === "sueldo" ? "Sueldo del mes" : "Otros ingresos del mes"}>
      <span className={`${a.bannerIcon} material-symbols-rounded`}>{income.id === "sueldo" ? "payments" : "savings"}</span>
      <span className={a.bannerText}>
        <strong>{isToday ? `Hoy cobrás ${income.title}` : `¿Ya cobraste ${income.title}?`}</strong>
        <span>Confirmalo y lo sumamos a tu cuenta.</span>
      </span>
      <div className={h.salaryForm}>
        <span className={h.salaryCur}>{income.currency === "USD" ? "US$" : "$"}</span>
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
