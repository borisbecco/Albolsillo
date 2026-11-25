"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { pendingRecurring } from "@/lib/recurring";
import { CATEGORY_BY_ID, catColor, catTint } from "@/lib/categories";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { todayAR } from "@/components/tx/parts";
import a from "@/components/auto/auto.module.css";
import h from "./dashboard.module.css";

const skipKey = (month: string) => `ab-recurrentes-${month}`;
const readSkipped = (month: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(skipKey(month)) ?? "[]");
  } catch {
    return [];
  }
};

/** "Se repite este mes": los recurrentes que tocan y no se cargaron, para sumarlos con un toque. */
export function RecurringBanner() {
  const { user, flash } = useShell();
  const { transactions, accounts, cards, createTx } = useData();
  const today = todayAR();
  const month = today.slice(0, 7);
  const [skipped, setSkipped] = useState<string[]>(() => readSkipped(month));
  const [busy, setBusy] = useState<string | null>(null);

  // El sueldo tiene su propio aviso si está configurado.
  const due = pendingRecurring(transactions, today, (t) => !!Number(user.salary) && t.category_id === "sueldo").filter((d) => !skipped.includes(d.key));
  if (!due.length) return null;

  const skip = (key: string) => {
    const next = [...skipped, key];
    try {
      localStorage.setItem(skipKey(month), JSON.stringify(next));
    } catch {}
    setSkipped(next);
  };

  const add = async (key: string) => {
    const t = due.find((d) => d.key === key)!.last;
    setBusy(key);
    await createTx({
      type: t.type === "in" ? "in" : "out",
      date: today,
      description: t.description,
      category_id: t.category_id,
      amount: t.amount,
      currency: t.currency,
      // Si la cuenta o la tarjeta ya no existen, queda sin cuenta (se puede editar después).
      account_id: t.account_id && accounts.some((x) => x.id === t.account_id) ? t.account_id : null,
      card_id: t.card_id && cards.some((x) => x.id === t.card_id) ? t.card_id : null,
      recurring: true,
    });
    setBusy(null);
    flash(`${t.type === "in" ? "Ingreso" : "Gasto"} sumado: ${t.description}`, t.type === "in" ? "ingreso" : "gasto");
  };

  return (
    <section className={`${a.banner} ${h.rec}`} aria-label="Movimientos que se repiten">
      <span className={`${a.bannerIcon} material-symbols-rounded`}>autorenew</span>
      <div className={h.recBody}>
        <strong>{due.length === 1 ? "Se repite este mes" : `${due.length} movimientos se repiten este mes`}</strong>
        <ul className={h.recList}>
          {due.slice(0, 4).map((d) => {
            const t = d.last;
            const where = t.card_id ? cards.find((c) => c.id === t.card_id)?.name : accounts.find((x) => x.id === t.account_id)?.name;
            return (
              <li key={d.key} className={h.recRow}>
                <span className={`${h.recCat} material-symbols-rounded`} style={{ color: catColor(t.category_id), background: catTint(t.category_id) }}>
                  {CATEGORY_BY_ID[t.category_id]?.icon ?? "category"}
                </span>
                <span className={h.recText}>
                  <strong>{t.description}</strong>
                  <span>
                    {formatMoney(Number(t.amount), t.currency)} · el {d.day}
                    {where ? ` · ${where}` : ""}
                  </span>
                </span>
                <button className={h.recSkip} onClick={() => skip(d.key)} title="Este mes no">
                  Saltar
                </button>
                <button className={a.bannerBtn} onClick={() => add(d.key)} disabled={busy === d.key}>
                  {busy === d.key ? "Sumando…" : "Sumar"}
                </button>
              </li>
            );
          })}
        </ul>
        {due.length > 4 && <span className={h.recMore}>Y {due.length - 4} más: aparecen al sumar estos.</span>}
      </div>
    </section>
  );
}
