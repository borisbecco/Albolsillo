"use client";

import { useState } from "react";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import type { BankId, Network } from "@/lib/banks";
import { CardFace } from "@/components/cards/CardFace";
import type { CardDto } from "@/lib/dto";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { TxIcon } from "@/components/tx/parts";
import { merchantDomain } from "@/lib/merchants";
import { dueInfo, loanStatus } from "./obligations";
import { entityDomain } from "@/lib/entities";
import { Logo } from "@/components/shell/Logo";
import d from "./debts.module.css";

export function DebtsView() {
  const { month, isPastMonth, flash, setDebtSheet, setImportFor } = useShell();
  const { cards, bills, loans, installments, isBillPaid, payBill, unpayBill, toDisplay, user } = useDebtsData();
  const [busyBill, setBusyBill] = useState<string | null>(null);
  const mShort = MONTH_SHORT[Number(month.slice(5)) - 1];

  if (!cards.length && !bills.length && !loans.length) {
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
          <button className={d.pillBtn} onClick={() => (cards.length ? setImportFor({ cardId: null }) : flash("Primero agregá la tarjeta"))}>
            <span className="material-symbols-rounded">upload_file</span>
            Importar resumen
          </button>
        </div>
        <div className={d.cards}>
          {cards.map((c, i) => (
            <div key={c.id} className={d.cardBox}>
              <button className={d.face} onClick={() => setDebtSheet({ kind: "card", id: c.id })} aria-label={`Editar ${c.name}`}>
                <CardFace
                  name={c.name}
                  bank={c.bank as BankId | null}
                  network={c.network as Network}
                  balance={Number(c.balance)}
                  usd={Number(c.balance_usd)}
                  last4={c.last4}
                  dueDay={c.due_day}
                  index={i}
                  month={month}
                />
              </button>
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
              {installments.some((q) => q.card_id === c.id) && (
                <div className={d.cuotas}>
                  <span className={d.cuotasTitle}>Cuotas sin interés</span>
                  {installments
                    .filter((q) => q.card_id === c.id)
                    .map((q) => (
                      <div key={q.id} className={d.cuota}>
                        <div>
                          <span>{q.name}</span>
                          <span className={d.rowSub}>{formatMoney(Number(q.amount), "ARS")}/mes</span>
                        </div>
                        <div className={d.cuotaBar}>
                          <div>
                            <div style={{ width: `${(q.n / q.of) * 100}%` }} />
                          </div>
                          <span>
                            {q.n} de {q.of}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
              <CardCycle card={c} />
            </div>
          ))}
          <button className={d.addCard} onClick={() => setDebtSheet({ kind: "card", id: null })}>
            <span className="material-symbols-rounded">add_card</span>
            Agregar tarjeta
            <small>Saldo, mínimo y fechas del resumen</small>
          </button>
        </div>
      </section>

      <section className={d.block}>
        <div className={d.blockHead}>
          <span className={d.blockTitle}>Préstamos</span>
          <button className={d.pillBtn} onClick={() => setDebtSheet({ kind: "loan", id: null })}>
            <span className="material-symbols-rounded">add</span>
            Agregar préstamo
          </button>
        </div>
        <div className={d.list}>
          {!loans.length && (
            <div className={d.emptyLoans}>
              <span className="material-symbols-rounded">account_balance</span>
              <span>No tenés préstamos cargados. Sumalos para que la cuota entre en el plan del mes y te avisemos antes de cada vencimiento.</span>
              <button className={d.payBtn} onClick={() => setDebtSheet({ kind: "loan", id: null })}>
                Agregar préstamo
              </button>
            </div>
          )}
          {loans.map((l) => {
            const st = loanStatus(month, l);
            return (
              <div key={l.id} className={d.loanRow} style={{ opacity: st.done ? 0.6 : 1 }}>
                <Logo domain={entityDomain(l.lender || l.name)} icon="account_balance" radius={12} />
                <div className={d.loanInfo}>
                  <strong>{l.name}</strong>
                  <span>
                    Cuota {formatMoney(Number(l.installment), "ARS")}
                    {Number(l.tna) ? ` · TNA ${Number(l.tna)}%` : ""} · vence el {l.due_day}
                  </span>
                </div>
                <div className={d.loanProgress}>
                  <span className={d.loanTrack}>
                    <span style={{ width: `${(l.n / l.of) * 100}%` }} />
                  </span>
                  <span>
                    {l.n}/{l.of} cuotas
                  </span>
                </div>
                <div className={d.loanBal}>
                  <strong>{formatMoney(Number(l.balance), "ARS")}</strong>
                  <span>saldo restante</span>
                </div>
                <div className={d.loanActions}>
                  <span className={d.status} style={{ color: st.color, background: `color-mix(in oklch, ${st.color} 16%, transparent)` }}>
                    {st.label}
                  </span>
                  {st.canPay && (
                    <button
                      className={d.payBtn}
                      disabled={isPastMonth}
                      title={isPastMonth ? "En un mes pasado no se puede cargar nada" : undefined}
                      onClick={() => setDebtSheet({ kind: "loanpay", id: l.id })}
                    >
                      Pagar cuota
                    </button>
                  )}
                  <button className={`${d.iconBtn} material-symbols-rounded`} title="Editar" aria-label={`Editar ${l.name}`} onClick={() => setDebtSheet({ kind: "loan", id: l.id })}>
                    edit
                  </button>
                </div>
              </div>
            );
          })}
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
                <TxIcon categoryId={b.category_id} domain={merchantDomain(b.name)} />
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

/** Lo pagado del resumen vigente, las compras nuevas del ciclo y las acciones de la tarjeta. */
function CardCycle({ card }: { card: CardDto }) {
  const { month, isPastMonth, setDebtSheet } = useShell();
  const { transactions, toDisplay, user } = useDebtsData();
  const start = card.cycle_start ?? `${month}-01`;
  const buys = transactions
    .filter((t) => t.card_id === card.id && t.type === "out" && t.date >= start && (t.installment_number ?? 1) === 1)
    .reduce((s, t) => s + toDisplay(Number(t.amount), t.currency), 0);
  const paid = Number(card.cycle_paid);
  const paidUsd = Number(card.cycle_paid_usd);
  const bal = Number(card.balance);
  const usd = Number(card.balance_usd);
  const covered = bal > 0 && paid >= bal - 0.005 && paidUsd >= usd - 0.005;
  return (
    <div className={d.cycle}>
      {(paid > 0 || paidUsd > 0) && (
        <div className={d.cardNote}>
          <span className="material-symbols-rounded">{covered ? "task_alt" : "payments"}</span>
          <span>
            {covered
              ? "Pagaste este resumen. Cuando cierre el próximo, cargalo acá: lo pagado vuelve a cero y las cuotas avanzan un mes."
              : `Ya pagaste ${formatMoney(paid, "ARS")}${paidUsd ? ` y ${formatMoney(paidUsd, "USD")}` : ""} · faltan ${formatMoney(Math.max(0, bal - paid), "ARS")}`}
          </span>
        </div>
      )}
      {buys > 0 && (
        <div className={d.cardNote}>
          <span className="material-symbols-rounded">shopping_bag</span>
          <span>
            Compras nuevas: {formatMoney(buys, user.display_currency)}. Entran en el resumen que cierra el {card.close_day}.
          </span>
        </div>
      )}
      <div className={d.cardBtns}>
        <button className={d.payBtn} disabled={isPastMonth || bal + usd <= 0} onClick={() => setDebtSheet({ kind: "cardpay", id: card.id })}>
          {covered ? "Registrar otro pago" : "Registrar pago"}
        </button>
        <button className={d.pillBtn} onClick={() => setDebtSheet({ kind: "stmt", id: card.id })}>
          <span className="material-symbols-rounded">receipt_long</span>
          Cargar resumen nuevo
        </button>
        <button className={`${d.iconBtn} material-symbols-rounded`} style={{ flex: "none", height: 36, width: 36 }} title="Editar o eliminar" aria-label={`Editar ${card.name}`} onClick={() => setDebtSheet({ kind: "card", id: card.id })}>
          edit
        </button>
      </div>
    </div>
  );
}

function useDebtsData() {
  const data = useData();
  const { user } = useShell();
  return { ...data, user };
}
