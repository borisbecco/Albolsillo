"use client";

import { useState } from "react";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import type { BankId, Network } from "@/lib/banks";
import { CardFace } from "@/components/cards/CardFace";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { CatIcon } from "@/components/tx/parts";
import { dueInfo } from "./obligations";
import d from "./debts.module.css";

export function DebtsView() {
  const { month, isPastMonth, flash, setDebtSheet } = useShell();
  const { cards, bills, isBillPaid, payBill, unpayBill, toDisplay, user } = useDebtsData();
  const [busyBill, setBusyBill] = useState<string | null>(null);
  const mShort = MONTH_SHORT[Number(month.slice(5)) - 1];

  if (!cards.length && !bills.length) {
    return <EmptyState copy={EMPTY.debts!} />;
  }

  const togglePay = async (id: string, name: string, paid: boolean) => {
    if (isPastMonth) return flash("En un mes pasado no se puede cargar nada.");
    setBusyBill(id);
    const ok = paid ? await unpayBill(id, month) : await payBill(id, month);
    setBusyBill(null);
    if (ok && !paid) flash(`${name} marcado como pagado`, "gasto");
  };

  const pending = bills.filter((b) => !isBillPaid(b.id, month));
  const pendingTotal = pending.reduce((s, b) => s + toDisplay(Number(b.amount), b.currency), 0);

  return (
    <div className={d.wrap}>
      <section className={d.block}>
        <div className={d.blockHead}>
          <span className={d.blockTitle}>Tarjetas de crédito</span>
          <button className={d.pillBtn} onClick={() => flash("Importar resumen llega en un próximo paso.")}>
            <span className="material-symbols-rounded">upload_file</span>
            Importar resumen
          </button>
        </div>
        <div className={d.cards}>
          {cards.map((c, i) => (
            <button key={c.id} className={d.cardBox} onClick={() => setDebtSheet({ kind: "card", id: c.id })} aria-label={`Editar ${c.name}`}>
              <div className={d.face}>
                <CardFace
                  name={c.name}
                  bank={c.bank as BankId | null}
                  network={c.network as Network}
                  balance={Number(c.balance)}
                  last4={c.last4}
                  dueDay={c.due_day}
                  index={i}
                  month={month}
                />
              </div>
              <div className={d.tiles}>
                <div className={d.tile}>
                  <span>Mínimo</span>
                  <strong>{formatMoney(Number(c.min_payment), "ARS")}</strong>
                </div>
                <div className={d.tile}>
                  <span>Cierre</span>
                  <strong>
                    {c.close_day} {mShort}
                  </strong>
                </div>
                <div className={d.tile}>
                  <span>TNA</span>
                  <strong style={{ color: "var(--red)" }}>{Number(c.tna)}%</strong>
                </div>
              </div>
            </button>
          ))}
          <button className={d.addCard} onClick={() => setDebtSheet({ kind: "card", id: null })}>
            <span className="material-symbols-rounded">add_card</span>
            Agregar tarjeta
          </button>
        </div>
      </section>

      <section className={d.block}>
        <span className={d.blockTitle}>Gastos fijos y suscripciones</span>
        <div className={d.list}>
          {bills.map((b) => {
            const paid = isBillPaid(b.id, month);
            const due = dueInfo(month, b.due_day, paid);
            return (
              <div key={b.id} className={d.row}>
                <CatIcon id={b.category_id} />
                <button className={d.rowMain} onClick={() => setDebtSheet({ kind: "bill", id: b.id })}>
                  <strong>{b.name}</strong>
                  <span className={d.rowSub}>
                    {CATEGORY_BY_ID[b.category_id]?.name} · día {b.due_day}
                    {b.auto_debit ? " · débito automático" : ""}
                  </span>
                  <span className={d.rowSub} style={{ color: due.color, width: "100%" }}>
                    {due.label}
                  </span>
                </button>
                <span className={d.amount}>{formatMoney(Number(b.amount), b.currency)}</span>
                <button
                  className={d.pay}
                  aria-pressed={paid}
                  disabled={busyBill === b.id || isPastMonth}
                  title={isPastMonth ? "En un mes pasado no se puede cargar nada" : paid ? "Deshacer el pago" : "Marcar como pagado"}
                  onClick={() => togglePay(b.id, b.name, paid)}
                >
                  {paid ? "✓ Pagado" : "Marcar pago"}
                </button>
              </div>
            );
          })}
          {bills.length > 0 && (
            <div className={d.summary}>
              <span>
                {pending.length ? `${pending.length} ${pending.length === 1 ? "pendiente" : "pendientes"} este mes` : "Todo pagado este mes"}
              </span>
              {pending.length > 0 && <strong>{formatMoney(pendingTotal, user.display_currency)}</strong>}
            </div>
          )}
          <button className={d.addRow} onClick={() => setDebtSheet({ kind: "bill", id: null })}>
            <span className="material-symbols-rounded">add</span>
            Agregar gasto fijo
          </button>
        </div>
      </section>
    </div>
  );
}

function useDebtsData() {
  const data = useData();
  const { user } = useShell();
  return { ...data, user };
}
