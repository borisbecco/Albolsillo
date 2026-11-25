"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT, currentMonth, todayAR } from "@/lib/month";
import { VIEWS } from "@/lib/nav";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { dueInfo, useObligations } from "@/components/debts/obligations";
import { CatIcon, TxIcon } from "@/components/tx/parts";
import { useSummary } from "./useSummary";
import h from "./dashboard.module.css";

/** Recientes / Próximos vencimientos. Marca posibles duplicados para borrarlos con un toque (con Deshacer). */
export function RecentPanel() {
  const { month, setDetailId, setDebtSheet } = useShell();
  const { transactions, deleteTxs } = useData();
  const [tab, setTab] = useState<"recent" | "upcoming">("recent");
  const nowMonth = currentMonth();
  const today = Number(todayAR().slice(8));

  // Mismo día, descripción (sin mayúsculas), monto y moneda que otro de la lista: el segundo es un posible duplicado.
  const seen = new Set<string>();
  const recent = transactions
    .filter((t) => t.date.startsWith(month))
    .slice(0, 6)
    .map((t) => {
      const k = `${t.date}|${t.description.trim().toLowerCase()}|${t.amount}|${t.currency}`;
      const dup = seen.has(k);
      seen.add(k);
      return { t, dup };
    });
  const obligations = useObligations(nowMonth);
  const upcoming = obligations.filter((o) => !o.paid && o.day >= today).slice(0, 6);
  const urgent = obligations.filter((o) => !o.paid && o.day - today <= 7).length;

  return (
      <section className={h.listPanel}>
        <div className={h.listHead}>
          <div className={h.tabs} role="tablist">
            <button role="tab" aria-selected={tab === "recent"} onClick={() => setTab("recent")}>
              Recientes
            </button>
            <button role="tab" aria-selected={tab === "upcoming"} onClick={() => setTab("upcoming")}>
              Próximos
              {urgent > 0 && <span className={h.tabBadge}>{urgent}</span>}
            </button>
          </div>
          <Link href={tab === "recent" ? VIEWS.mov.href : VIEWS.cal.href} className={h.more}>
            {tab === "recent" ? "Ver todos" : "Calendario"}
          </Link>
        </div>
        {tab === "recent" ? (
          <div className={h.fade} key="recent">
            {recent.map(({ t, dup }) => (
              <div
                key={t.id}
                className={h.item}
                role="button"
                tabIndex={0}
                onClick={() => setDetailId(t.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDetailId(t.id))}
              >
                <TxIcon categoryId={t.category_id} domain={t.merchant_domain} />
                <span className={h.itemName}>
                  <span className={h.itemText}>{t.description}</span>
                  {dup && (
                    <button
                      className={h.dupPill}
                      title="Mismo comercio, monto y fecha que otro movimiento. Tocá para eliminar este."
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteTxs([t.id]);
                      }}
                    >
                      <span className="material-symbols-rounded">content_copy</span>¿Duplicado? Eliminar
                    </button>
                  )}
                </span>
                <span className={h.itemDate}>
                  {Number(t.date.slice(8))} {MONTH_SHORT[Number(t.date.slice(5, 7)) - 1]}
                </span>
                <span className={h.itemAmount} style={{ color: t.type === "in" ? "var(--pos)" : "var(--fg)" }}>
                  {t.type === "in" ? "+" : "−"}
                  {formatMoney(Number(t.amount), t.currency)}
                </span>
              </div>
            ))}
            {!recent.length && <div className={h.emptyList}>Sin movimientos en este mes.</div>}
          </div>
        ) : (
          <div className={h.fade} key="upcoming">
            {upcoming.map((o) => {
              const d = dueInfo(nowMonth, o.day, o.paid);
              return (
                <button key={o.key} className={h.item} onClick={() => setDebtSheet({ kind: o.kind, id: o.id })}>
                  {o.kind === "card" ? <span className={`${h.cardIcon} material-symbols-rounded`}>credit_card</span> : <CatIcon id={o.categoryId ?? "otros"} />}
                  <span className={h.itemName}>{o.name}</span>
                  <span className={h.itemDate} style={{ color: d.color }}>
                    {d.label}
                  </span>
                  <span className={h.itemAmount}>{formatMoney(o.amount, o.currency)}</span>
                </button>
              );
            })}
            {!upcoming.length && <div className={h.emptyList}>Nada por vencer en lo que queda del mes.</div>}
          </div>
        )}
      </section>
  );
}

/** "Qué pagar este mes": lo que dice el plan para cada tarjeta y los fijos pendientes. */
export function PayPanel() {
  const { user, setDebtSheet } = useShell();
  const { toDisplay } = useData();
  const { plan, pendingFixed } = useSummary();
  const cur = user.display_currency;
  return (
      <section className={h.listPanel}>
        <div className={h.listHead}>
          <strong>Qué pagar este mes</strong>
          <Link href={VIEWS.plan.href} className={h.more}>
            Ver plan →
          </Link>
        </div>
        {plan.rows.map((r) => (
          <button key={r.id} className={h.planRow} title="Registrar pago" onClick={() => setDebtSheet({ kind: "cardpay", id: r.id })}>
            <span className={h.itemName}>{r.name}</span>
            <span className={h.planTag} style={{ color: r.tagColor }}>
              {r.tag}
            </span>
            <span className={h.itemAmount}>{formatMoney(toDisplay(r.pay, "ARS"), cur)}</span>
          </button>
        ))}
        {!plan.rows.length && <div className={h.emptyList}>Sin tarjetas con saldo a pagar.</div>}
        <div className={h.planFoot}>
          <span>Obligaciones fijas pendientes</span>
          <strong>{formatMoney(toDisplay(pendingFixed, "ARS"), cur)}</strong>
        </div>
      </section>
  );
}
